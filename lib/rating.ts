import { z } from "zod";

/* ==========================================================================
   Rating protocol. The client never gets to describe what it rated — that
   travels inside a signed receipt minted at decide time (see lib/receipt.ts).
   This module is pure: safe to import from client and server.
   ========================================================================== */

export const RATING_LIMITS = {
  min: 1,
  max: 5,
  commentMax: 600,
  /** A rating older than this is treated as a replay and refused. */
  receiptTtlMs: 24 * 60 * 60 * 1000,
} as const;

export const ratingRequestSchema = z.object({
  /** Opaque signed receipt, echoed verbatim from the decide response. */
  receipt: z.string().min(40).max(2000),
  score: z.number().int().min(RATING_LIMITS.min).max(RATING_LIMITS.max),
  comment: z.string().trim().max(RATING_LIMITS.commentMax).optional(),
  meta: z.object({
    /** Decision render → rating, a useful signal on its own. */
    timeToRateMs: z.number().min(0).max(RATING_LIMITS.receiptTtlMs),
  }),
});

export type RatingRequest = z.infer<typeof ratingRequestSchema>;

/** What the signed receipt carries. All of it is derived server-side from the
 *  JEV response, never from the client, so the ratings collection stands alone
 *  for calibration analysis without joining back to `decisions`. */
export interface ReceiptPayload {
  /** Firestore document id of the decision being rated. */
  id: string;
  /** The language the author wrote in, and therefore the language the Reading
   *  is delivered in. Derived server-side, never from the browser. */
  sourceLang: "en" | "bn";
  /** sha256 over the English state and questions the Reading prompt is built
   *  from. /api/advise checks it so the stored narrative provably describes
   *  the text the author actually wrote. */
  promptHash: string;
  /** sha256 of the serialised JEV answers this receipt was minted for.
   *  /api/advise requires the submitted answers to hash to this, so the
   *  narrative stored against a decision provably describes that decision's
   *  real output rather than whatever the browser chose to send. */
  answersHash: string;
  model: string;
  issuedAt: number;
  answerCount: number;
  /** Ordered answer types, e.g. ["noul","choice"]. */
  answerTypes: Array<"noul" | "choice" | "score">;
  /** Mean of the model's own confidence figures, 0–1. noul has none, so this
   *  is null when every answer was a noul — the key column for testing
   *  whether the model's stated confidence predicts human usefulness. */
  meanConfidence: number | null;
  /** Highest single-option probability across choice answers, 0–1. */
  peakProbability: number | null;
}
