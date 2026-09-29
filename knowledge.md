# JEV — TypeSafe "System One" Decision Model (via OpenRouter)

> Knowledge base for this project. Gathered 2026-09-29 from OpenRouter's official
> tutorial + independent references. Jev is **not** a chat/text model — it is a
> structured **decision** model. It cannot be called via `/chat/completions`.

## 1. What Jev is

- Model from TypeSafe AI, class "System One": takes a **state** (context payload)
  and a set of typed **questions**, returns structured **answers** (probabilities /
  choices / scores), never generated text.
- Modality: `text -> decisions`. Use it for classification, moderation, routing,
  judging, rubric scoring — anything deterministic-in-code can't do.
- Keep arithmetic, counting, date logic, and lookups in code — TypeSafe flags those
  as unsuitable for Jev questions.

## 2. Endpoints & model IDs

| Item | Value |
|---|---|
| OpenRouter alpha endpoint | `POST https://openrouter.ai/api/alpha/decisions` (per OpenRouter's official tutorial) |
| OpenRouter stable route | `POST https://openrouter.ai/api/v1/systemone` (reported by independent refs; same native schema, batching supported) |
| Direct TypeSafe endpoint | `POST https://api.typesafe.ai/v1/systemone` (needs TypeSafe console key — not our path) |
| Model ID (pinned, use this) | `typesafe/jev-1.13` |
| Alias (auto-upgrades — avoid in prod) | `~typesafe/jev-latest` |
| Auth | `Authorization: Bearer $OPENROUTER_API_KEY` (any OpenRouter key; no TypeSafe account needed) |
| Optional headers | `HTTP-Referer`, `X-Title` (OpenRouter analytics/attribution) |

⚠️ Sending `typesafe/jev-1.13` to `/chat/completions` returns an error pointing to
the decisions endpoint. SDK: `@openrouter/sdk` (e.g. 1.3.17) →
`openrouter.alpha.decisions.create({ decisionsRequest: {...} })`, or point the
TypeSafe SDK at `baseURL: "https://openrouter.ai/api"`.

## 3. Request schema

```jsonc
{
  "model": "typesafe/jev-1.13",        // required
  "state": { ... },                    // string | object | string[] — the thing to judge; shared across all questions
  "questions": {                       // keyed map; keys come back under answers
    "<question_id>": {
      "type": "choice" | "noul" | "score",
      "instructions": "...",           // required; the judgment to make. Can reference state fields via `backtick.paths`
      "criteria": ...                  // shape depends on type (below)
    }
  }
}
```

All questions in one request are evaluated independently, in parallel, in a single
round trip — state tokens are processed once. **Batch questions, don't loop calls.**

## 4. Question types (IN) → answer shapes (OUT)

### `noul` — boolean probability
- **In:** `criteria` optional, object with `"true"` / `"false"` descriptions.
- **Out:** `{ "type": "noul", "noul": 0.05 }`
- `noul` ∈ [0,1] = calibrated probability the statement is **true**.
- **No `confidence`, no boolean `result`** — caller applies its own threshold
  (e.g. `noul >= 0.85`).

### `choice` — pick one of N options
- **In:** `criteria` = object mapping 2–255 option labels → descriptions (or null).
- **Out:** `{ "type": "choice", "choice": "<winner key>", "probabilities": {"a": 0.7, ...}, "confidence": 0.9 }`
- `probabilities` sums to 1.0 across options.
- ⚠️ `confidence` (0–1) summarizes the **whole distribution** — it is *not* the
  probability of the winning option.

### `score` — ordinal rubric
- **In:** `criteria` = ordered array of 2–10 level-description strings (index 0 = lowest level). Prefer 3–5 tiers.
- **Out:** `{ "type": "score", "score": 1, "legend": {"0": "...", ...}, "probabilities": {"0": 0, "1": 1, ...}, "confidence": 1 }`
- `score` = probability-weighted **expected value** over zero-based indices
  (Σ i × pᵢ) — can be fractional; `legend` maps index → description.

## 5. Full response envelope

```jsonc
{
  "model": "typesafe/jev-1.13-20260917",   // dated build actually used
  "answers": { "<question_id>": { "type": ..., ... } },
  "usage": { "input_tokens": 492, "output_tokens": 38, "cost": 0.000020664 },
  "id": "gen-dec-...",
  "provider": "TypeSafe"
}
```

Validate the response shape (presence/types of `confidence`, `probabilities`,
`usage.cost`) and **throw on mismatch** — SDK types mark these optional; don't
silently default them.

## 6. Pricing, context, limits

| Item | Value |
|---|---|
| Input | **$0.042 / 1M input tokens** |
| Output | **free** ($0.00 — structured, non-generative) |
| Context via OpenRouter | **32,000 tokens flat per request** (catalog-enforced) |
| Context via direct TypeSafe API | 64,000 total; `state` + longest single question ≤ 32,000 |
| Rate limits (early access, direct API) | ~1,200 RPM / 250,000 TPS per org |
| Token budget | consumed by both `state` and all `questions` |
| Cost feel | ~$0.000021 for a 2-question call; ~$0.0011 for 24 items × 5 questions |

## 7. Errors (HTTP)

- **401** — missing/malformed/revoked key
- **422** — schema violation: missing `instructions`, choice options <2 or >255,
  score levels <2 or >10, bad criteria types, context overflow
- **429** — rate/token limit; honors `Retry-After` / `retry-after-ms`
- **529** — cluster overloaded, transient; retry with exponential backoff + jitter
  (official SDKs do this automatically)

## 8. Practical rules for this project

1. **Pin** `typesafe/jev-1.13`; the `~typesafe/jev-latest` alias can silently change behavior.
2. **Batch** all questions for one entity into a single call (shared state = billed once).
3. Derive decision **thresholds from labeled data**: judge a labeled sample once,
   save answers, replay candidate thresholds over them.
4. For >255-option taxonomies use a two-tier hierarchy (coarse choice → fine choice).
5. Stay under OpenRouter's 32k flat cap when batching many questions.
6. Treat `confidence` as distribution-level, not winner probability; apply your own
   threshold to `noul`.

## Sources

- [OpenRouter official tutorial — How to Use Jev (TypeScript)](https://openrouter.ai/blog/tutorials/how-to-use-jev/)
- [aimodelwaddle — Jev API Reference](https://www.aimodelwaddle.com/jev-api)
- [jevai.fyi — OpenRouter integration](https://www.jevai.fyi/integrations/openrouter/)
- [github.com/rajivkuriakose/typesafe-jev-examples](https://github.com/rajivkuriakose/typesafe-jev-examples)
- [github.com/SadiqOnGithub/jev-lab](https://github.com/SadiqOnGithub/jev-lab)

*Note: endpoint paths from independent sources (`/api/v1/systemone` as stable vs
`/api/alpha/decisions` as alpha) are not fully cross-confirmed — verify against
OpenRouter docs before wiring production code.*
