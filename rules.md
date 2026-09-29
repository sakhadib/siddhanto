# Firestore Security Rules — Siddhanto

Paste the block below into **Firebase Console → Firestore Database → Rules**
(or deploy with `firebase deploy --only firestore:rules` if you use the CLI).

## What these rules enforce

- `decisions` is **create-only** — nobody can read, update, or delete funnel data
  from a client. (Read it in the Firebase console or via Admin SDK scripts.)
- `ratings` accepts create and update only, keyed `r_<decisionId>` so there is
  at most one rating per response and it can be revised. Reads and deletes are
  denied. Every descriptive field in a rating is derived server-side from the
  signed receipt, not from the browser.
- `advice` accepts create and update only, keyed `a_<decisionId>`, same
  posture.
- Writes must match the exact shape `lib/firestore.ts` (`recordDecision`) produces.
- Size caps mirror the app's limits (state ≤1300 chars, ≤10 questions,
  instructions ≤512 chars) so rules alone can't be used to dump huge payloads.
- Everything else in the database is denied by default.

## The rules

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- helpers ----------
    function isStr(v, maxLen) {
      return v is string && v.size() <= maxLen;
    }

    function validMeta(meta) {
      return meta is map
        && meta.keys().hasOnly(['ipHash', 'userAgent', 'referer', 'timeOnFormMs', 'flagged'])
        && meta.keys().hasAll(['ipHash', 'userAgent', 'referer', 'timeOnFormMs'])
        && isStr(meta.ipHash, 64)
        && isStr(meta.userAgent, 320)
        && isStr(meta.referer, 520)
        && meta.timeOnFormMs is number
        && meta.timeOnFormMs >= 0
        && (!meta.keys().hasAny(['flagged']) || meta.flagged == null || isStr(meta.flagged, 40));
    }

    function validQuestion(q) {
      return q is map
        && q.keys().hasOnly(['type', 'instructions', 'criteria'])
        && q.keys().hasAll(['type', 'instructions'])
        && q.type in ['noul', 'score', 'choice']
        && isStr(q.instructions, 512)
        && q.instructions.size() > 0;
        // criteria shape varies per type (map / list); validated in the API
        // layer with Zod — rules only cap its presence, not its inner shape.
    }

    function validJev(jev) {
      // jev is null on failed attempts, otherwise the decision record
      return jev == null || (
        jev is map
        && jev.keys().hasOnly(['model', 'answers', 'usage', 'id', 'provider'])
        && jev.keys().hasAll(['model', 'answers', 'usage'])
        && isStr(jev.model, 80)
        && jev.answers is map
        && jev.usage is map
      );
    }

    function validError(err) {
      return err == null || (
        err is map
        && err.keys().hasOnly(['stage', 'message'])
        && err.keys().hasAll(['stage', 'message'])
        && isStr(err.stage, 20)
        && isStr(err.message, 600)
      );
    }

    // ---------- decisions (the funnel) ----------
    match /decisions/{doc} {
      allow create: if request.resource.data.keys().hasOnly(
                          ['createdAt', 'state', 'questions', 'jev', 'meta', 'error'])
        && request.resource.data.keys().hasAll(['createdAt', 'meta'])
        && request.resource.data.createdAt == request.time
        && (request.resource.data.state == null
            || isStr(request.resource.data.state, 1300))
        && (request.resource.data.questions == null
            || (request.resource.data.questions is list
                && request.resource.data.questions.size() <= 10
                && validAllQuestions(request.resource.data.questions)))
        && validJev(request.resource.data.jev)
        && validMeta(request.resource.data.meta)
        && validError(request.resource.data.error);

      allow read, update, delete: if false;
    }

    function validAllQuestions(qs) {
      // Firestore rules can't loop with custom predicates directly on lists,
      // so we verify each of the (max 10) positions individually.
      return qs.size() == 0 || (
        (qs.size() < 1  || validQuestion(qs[0]))
        && (qs.size() < 2  || validQuestion(qs[1]))
        && (qs.size() < 3  || validQuestion(qs[2]))
        && (qs.size() < 4  || validQuestion(qs[3]))
        && (qs.size() < 5  || validQuestion(qs[4]))
        && (qs.size() < 6  || validQuestion(qs[5]))
        && (qs.size() < 7  || validQuestion(qs[6]))
        && (qs.size() < 8  || validQuestion(qs[7]))
        && (qs.size() < 9  || validQuestion(qs[8]))
        && (qs.size() < 10 || validQuestion(qs[9]))
      );
    }

    // ---------- ratings (research) ----------
    // One rating per decision, keyed r_<decisionId>, so a response cannot
    // accumulate unbounded ratings. Read and delete stay denied: a rating is
    // research input, not something a client can browse back.
    // meanConfidence / peakProbability are null when every answer was a noul
    // (noul carries no confidence) — explicitly allowed.
    match /ratings/{doc} {
      allow create, update: if validRating(request.resource.data);

      allow read, delete: if false;
    }

    function validRating(r) {
      return r.keys().hasOnly(
                          ['decisionId', 'ratedAt', 'score', 'comment', 'model',
                           'answerCount', 'answerTypes', 'meanConfidence',
                           'peakProbability', 'meta'])
        && r.keys().hasAll(['decisionId', 'ratedAt', 'score', 'answerCount', 'meta'])
        && isStr(r.decisionId, 40)
        && r.decisionId.size() > 0
        && r.ratedAt == request.time
        && r.score is number
        && r.score >= 1
        && r.score <= 5
        && (r.comment == null || isStr(r.comment, 600))
        && isStr(r.model, 80)
        && r.answerCount is number
        && r.answerCount >= 1
        && r.answerCount <= 10
        && r.answerTypes is list
        && r.answerTypes.size() >= 1
        && r.answerTypes.size() <= 10
        && (r.meanConfidence == null
            || (r.meanConfidence is number && r.meanConfidence >= 0 && r.meanConfidence <= 1))
        && (r.peakProbability == null
            || (r.peakProbability is number && r.peakProbability >= 0 && r.peakProbability <= 1))
        && validRatingMeta(r.meta);
    }

    function validRatingMeta(meta) {
      return meta is map
        && meta.keys().hasOnly(['ipHash', 'userAgent', 'referer', 'timeToRateMs'])
        && meta.keys().hasAll(['ipHash', 'userAgent', 'referer', 'timeToRateMs'])
        && isStr(meta.ipHash, 64)
        && isStr(meta.userAgent, 320)
        && isStr(meta.referer, 520)
        && meta.timeToRateMs is number
        && meta.timeToRateMs >= 0;
    }

    // ---------- advice (the reading layer) ----------
    // One narrative per decision, keyed a_<decisionId>. The text is written
    // after the stream has already reached the browser, so a failure here
    // loses the research record but never the user's reading.
    match /advice/{doc} {
      allow create, update: if validAdvice(request.resource.data);

      allow read, delete: if false;
    }

    function validAdvice(a) {
      return a.keys().hasOnly(
                          ['decisionId', 'advisedAt', 'text', 'complete', 'model',
                           'answerCount', 'answerTypes', 'meanConfidence', 'meta'])
        && a.keys().hasAll(['decisionId', 'advisedAt', 'text', 'complete', 'meta'])
        && isStr(a.decisionId, 40)
        && a.decisionId.size() > 0
        && a.advisedAt == request.time
        && isStr(a.text, 2000)
        && a.text.size() > 0
        && a.complete is bool
        && isStr(a.model, 80)
        && a.answerCount is number
        && a.answerCount >= 1
        && a.answerCount <= 10
        && a.answerTypes is list
        && a.answerTypes.size() >= 1
        && a.answerTypes.size() <= 10
        && (a.meanConfidence == null
            || (a.meanConfidence is number && a.meanConfidence >= 0 && a.meanConfidence <= 1))
        && validAdviceMeta(a.meta);
    }

    function validAdviceMeta(meta) {
      return meta is map
        && meta.keys().hasOnly(['ipHash', 'userAgent', 'referer'])
        && meta.keys().hasAll(['ipHash', 'userAgent', 'referer'])
        && isStr(meta.ipHash, 64)
        && isStr(meta.userAgent, 320)
        && isStr(meta.referer, 520);
    }

    // ---------- deny everything else ----------
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## After pasting

1. Click **Publish** in the console.
2. Re-run the app and submit a decision — the server log should stop showing
   `PERMISSION_DENIED`, and documents should appear under `decisions` in the
   Firestore data viewer.

### Ratings will not save until you republish

The `ratings` block is new. Until the rules above are published, a rating
POST returns **502 `Could not record the rating.`** and the write fails with
`PERMISSION_DENIED` — the `decisions` block and the `ratings` block live in
the same ruleset, so publishing one publishes both. The app surfaces the
failure in the UI rather than dropping the rating silently.

Verify with:

```bash
curl -X POST http://localhost:3000/api/rate \
  -H 'Content-Type: application/json' \
  -d '{"receipt":"<receipt from /api/decide>","score":4,"meta":{"timeToRateMs":1000}}'
# expect {"ok":true}, not a 502
```

## Notes

- `createdAt == request.time` works because `recordDecision` writes
  `serverTimestamp()` — the rule ensures clients can't backdate records.
- Failed/invalid submissions are recorded with `state: null` / `questions: null`
  and `error` set — the rules explicitly allow the null variants.
- If you later add the Firestore-backed rate-limit collection from plan.md §7.4
  (`ratelimits/...`), give it its own `match` block above the catch-all deny.
