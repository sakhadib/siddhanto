# Firestore Security Rules — Siddhanto

The ruleset itself lives in **[`firestore.rules`](./firestore.rules)** — open that
file and copy the whole thing into **Firebase Console → Firestore Database →
Rules**, or deploy it with `firebase deploy --only firestore:rules`.

That file is the single source of truth. It used to be duplicated inline here,
which is how the deployed copy and this document drifted apart.

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

See [`firestore.rules`](./firestore.rules).

## After pasting

1. Click **Publish** in the console.
2. Re-run the app and submit a decision — the server log should stop showing
   `PERMISSION_DENIED`, and documents should appear under `decisions` in the
   Firestore data viewer.

### `ratings` and `advice` will not save until you republish

Those two blocks are newer than what is deployed. Until the current file is
published:

- a rating POST returns **502 `Could not record the rating.`**
- the reading still streams to the user, but the `advice` write fails

Both are `PERMISSION_DENIED` at the Firestore layer, and all three blocks live
in one ruleset, so publishing one publishes all of them. The app surfaces both
failures in the UI rather than dropping data silently.

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
