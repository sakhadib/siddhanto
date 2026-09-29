# Siddhanto — Implementation Plan

> Derived from `pre-plan.md`. JEV API contract lives in `knowledge.md` — consult it
> before touching any OpenRouter/JEV code.

## 1. Product summary

A public, mobile-first web app where anyone (no auth) can:

1. Type a **state** (context, ≤ 1200 chars, strictly enforced).
2. Add **1–10 questions** about that state, each typed as **NOUL**, **SCORE**, or
   **CHOICE**, with the criteria/options JEV requires per type.
3. Hit **Decide** → the request goes to JEV (`typesafe/jev-1.13`) via OpenRouter.
4. See the returned decisions — probabilities, distributions, confidence — as rich
   visualizations.

Every submission (state, questions, answers, metadata) is recorded to Firestore —
this is a **data-funnel site**. A Privacy page states this plainly.

## 2. Stack & hosting (assumptions)

| Decision | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One deploy target on Vercel; API routes keep the OpenRouter key server-side |
| Hosting | **Vercel** (app + API) | `OPENROUTER_API_KEY` in Vercel env secrets; `.env.local` for dev |
| Data | **Firebase Firestore** (existing `siddhanto` project) | Recording only; client SDK initialized from existing `firebase.ts` |
| Styling | **Tailwind CSS** | Fast mobile-first iteration |
| JEV call | raw `fetch` to `POST https://openrouter.ai/api/alpha/decisions` | Simple, no SDK lock-in; schema is small (knowledge.md §3–5) |

"Firebase + Vercel" is interpreted as: Vercel serves the app, Firebase provides
Firestore. No Firebase Hosting — nothing to deploy there.

## 3. Architecture

```
Browser (mobile-first UI)
   │  POST /api/decide  { state, questions[], _meta }
   ▼
Next.js Route Handler (server, key never leaves server)
   │  1. anti-automation checks (§7)
   │  2. validate + normalize (§5)
   │  3. build JEV payload  { model, state, questions }
   │  4. POST openrouter.ai/api/alpha/decisions (Bearer OPENROUTER_API_KEY)
   │  5. write Firestore record (§6) — fire-and-log, never block the user on it
   │  6. return { answers, usage } to client
   ▼
Result visualizations (§8)
```

## 4. App structure

```
app/
  page.tsx               # Decision form (home)
  privacy/page.tsx       # Privacy & data-recording disclosure
  layout.tsx             # Shell, footer link to /privacy
  api/decide/route.ts    # POST handler — validation, JEV call, Firestore write
components/
  StateInput.tsx         # textarea + live char counter (1200 max, hard block)
  QuestionCard.tsx       # one question: instructions, type picker, criteria editor
  CriteriaEditor.tsx     # per-type: noul (optional true/false desc),
                         #   choice (2+ option label+desc rows, up to 255),
                         #   score (ordered 2–10 level descriptions, drag/±)
  ResultPanel.tsx        # renders answers per question
  NoulBar.tsx            # single probability bar (0–100%) + threshold hint
  ChoiceChart.tsx        # horizontal probability bars per option, winner highlighted
  ScoreScale.tsx         # level track with per-level probabilities + E[score] marker
  ConfidenceGauge.tsx    # 0–1 confidence arc; caption: "distribution-level, not winner probability"
  BotTrap.tsx            # honeypot field (§7)
lib/
  jev.ts                 # types + buildJevPayload() + callJev()
  validate.ts            # shared Zod schema (client + server, single source)
  firestore.ts           # re-export init from firebase.ts + recordDecision()
  ratelimit.ts           # server-side rate limiting (§7)
firebase.ts              # existing — keep; add getFirestore()
```

## 5. Validation rules (single Zod schema, enforced client AND server)

| Field | Rule | JEV constraint (knowledge.md) |
|---|---|---|
| `state` | string, 1–1200 chars, trimmed | context token budget |
| `questions` | array, 1–10 items | — |
| `question.id` | server-generated `q0..q9` | keys appear in `answers` |
| `question.instructions` | string, 1–512 chars | required for all types |
| NOUL `criteria` | optional `{ true?, false? }` descriptions | noul takes optional true/false desc |
| CHOICE `criteria` | 2–255 options: label → description | choice bounds |
| SCORE `criteria` | ordered array of 2–10 level descriptions | score bounds |

Server-side validation is authoritative (client validation is UX only).
Char counters in UI; server returns 400 with field-level errors on violation.

## 6. Firestore recording (the funnel)

Collection: `decisions` (create-only). One document per submission:

```jsonc
{
  "createdAt": "<serverTimestamp>",
  "state": "...",
  "questions": [ { "id", "type", "instructions", "criteria" } ],
  "jev": {
    "model": "typesafe/jev-1.13-20260917",   // dated build from response
    "answers": { ... },                       // full raw answers map
    "usage": { "input_tokens", "output_tokens", "cost" },
    "id": "gen-dec-...", "provider": "TypeSafe"
  },
  "meta": {
    "ipHash": "<sha256(ip + daily salt)>",   // funnel analytics without storing raw IPs
    "userAgent": "...",
    "referer": "...",
    "locale": "...",
    "timeOnFormMs": 0,                        // anti-automation signal too
    "turnstileScore": "pass|fail|bypassed"
  },
  "error": null | { "stage": "validate|jev|firestore", "message": "..." }
}
```

- Failed/invalid submissions are **also recorded** (with `error` set) — funnel data.
- Firestore security rules: `allow create` with strict field/type/size validation,
  `allow read, update, delete: if false`. No client reads anywhere in the app.
- Server writes use the client SDK under these rules (no Admin SDK needed since
  rules permit create); if rule friction appears, switch to Admin SDK in the route.

## 7. Anti-automation measures

Layered (defense in depth), all server-enforced:

1. **Cloudflare Turnstile** (free, no API key cost) — token verified server-side
   before any JEV call. Env: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`.
2. **Honeypot** — invisible `website` input; any value → silently fake-success,
   record with `meta.turnstileScore: "honeypot"`, never call JEV.
3. **Time-on-form** — client sends `timeOnFormMs`; submissions < 2s rejected/flagged.
4. **Rate limiting** — per-IP: 10 decisions/hour, 50/day. Firestore-backed counter
   doc (`ratelimits/{ipHash+hourBucket}`) with TTL; also a global daily circuit
   breaker (`config/costGuard`, max JEV calls/day) to cap OpenRouter spend.
5. **Header sanity** — reject missing/known-bot user agents, non-POST, missing
   `Origin`/`Sec-Fetch-*` mismatches.
6. JEV only ever called server-side — no key exposure, no direct browser→OpenRouter.

Note: automated browser testing (Playwright/Selenium) is out of scope for
development — verification is via unit tests, `curl`, and manual device testing.

## 8. Result visualization (per answer type)

- **NOUL** — large % readout + horizontal probability bar; caption showing the raw
  `noul` value; note that caller thresholds apply (no confidence field exists).
- **CHOICE** — winner card + horizontal bars for every option's probability
  (sorted desc, winner accent color, values labeled); confidence gauge beside it.
- **SCORE** — ordinal track of levels (from `legend`), per-level probability fill,
  marker at the expected `score` (Σ i·pᵢ, may be fractional); confidence gauge.
- **Confidence gauge** — shared component, with the honest caption from
  knowledge.md: *"summarizes the whole distribution — not the probability of the
  winning option."*
- Footer of results: model build, tokens, cost (from `usage`).

## 9. Pages & UX (mobile-first)

- **Home** — single-column flow: StateInput → QuestionCards (add/remove, max 10,
  type segmented-control NOUL/SCORE/CHOICE) → sticky "Decide" button. Touch
  targets ≥ 44px, inputs ≥ 16px font (no iOS zoom), results below the fold with
  smooth scroll-to.
- **Privacy** — plain-language page: no accounts, everything typed is recorded
  (state, questions, answers, hashed IP, UA) and used for data collection;
  OpenRouter/TypeSafe process submissions; contact/removal info. Linked from
  footer of every page + a notice line above the Decide button.
- Empty/loading/error states for each step; errors from the API shown inline.

## 10. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Vercel secret + `.env.local` | JEV calls |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | same | bot check |
| `IP_HASH_SALT` | same | daily-rotated IP hashing |
| Firebase config | already in `firebase.ts` (public-by-design) | Firestore init |

## 11. Build order (phases)

1. **Scaffold** — create-next-app (TS, Tailwind, App Router) into this repo;
   merge existing `firebase.ts`, `knowledge.md`, `plan.md`.
2. **Shared contract** — `lib/validate.ts` Zod schema + JEV types in `lib/jev.ts`.
3. **API route** — `/api/decide`: validate → call JEV → record → respond.
   Test with `curl` against dev server (no UI yet).
4. **Firestore** — rules (create-only, validated), `recordDecision()`, indexes n/a.
5. **Form UI** — StateInput, QuestionCard, CriteriaEditor, all limits enforced.
6. **Results UI** — ResultPanel + 4 viz components.
7. **Anti-automation** — Turnstile, honeypot, timing, rate limit, cost guard.
8. **Privacy page** + footer + pre-submit notice.
9. **Polish & ship** — mobile QA on real devices, loading/empty states,
   `vercel deploy`, set secrets, confirm records land in Firestore.

## 12. Cost guardrails

- JEV: $0.042 / 1M input tokens (output free). One full request
  (1200-char state + 10 questions) ≈ ~1.5k tokens ≈ $0.00006 — negligible, but
  the daily circuit breaker (§7.4) is the real protection against scripted abuse.
- Verify endpoint behavior on first integration against knowledge.md §2
  (alpha `/api/alpha/decisions` vs stable `/api/v1/systemone`) with a single curl.

## 13. Out of scope

- Auth/accounts of any kind.
- Reading past decisions back in the UI (funnel is write-only for users).
- Automated browser test suites (Playwright/Selenium excluded per constraints).
- i18n beyond initial `Accept-Language` capture.
