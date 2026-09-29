import { collection, addDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { createHash } from "crypto";
import { db } from "@/firebase";
import type { DecideRequest } from "./validate";
import type { JevResponse } from "./jev";
import type { ReceiptPayload } from "./rating";
import type { Lang } from "./lang";
import type { Question } from "./validate";

export interface RecordMeta {
  ip: string;
  userAgent: string;
  referer: string;
  timeOnFormMs: number;
  flagged?: string; // "honeypot" | "too-fast" | undefined for clean submissions
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "siddhanto-mvp-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

/**
 * Record a submission to the funnel. Never throws — recording failure must not
 * break the user's decision flow.
 *
 * Returns the new document id so a rating can be tied to this exact decision.
 * Returns null on any failure, which simply means the response cannot be rated.
 */
export async function recordDecision(
  req: DecideRequest | null,
  jev: JevResponse | null,
  meta: RecordMeta,
  error: { stage: string; message: string } | null = null,
  /**
   * The author's original text when it differs from what JEV read. A Bangla
   * submission is stored as the English translation the model actually saw
   * plus the Bangla original alongside it, which makes every non-English row
   * a usable bilingual pair.
   */
  source: { lang: Lang; state: string; questions: Question[] } | null = null
): Promise<string | null> {
  try {
    const ref = await addDoc(collection(db, "decisions"), {
      createdAt: serverTimestamp(),
      state: req?.state ?? null,
      questions: req?.questions ?? null,
      source,
      jev: jev
        ? { model: jev.model, answers: jev.answers, usage: jev.usage, id: jev.id ?? null, provider: jev.provider ?? null }
        : null,
      meta: {
        ipHash: hashIp(meta.ip),
        userAgent: meta.userAgent.slice(0, 300),
        referer: meta.referer.slice(0, 500),
        timeOnFormMs: meta.timeOnFormMs,
        flagged: meta.flagged ?? null,
      },
      error,
    });
    return ref.id;
  } catch (e) {
    console.error("[firestore] recordDecision failed:", e);
    return null;
  }
}

export interface AdviceInput {
  receipt: ReceiptPayload;
  text: string;
  /** The English the Reading was written in, when `text` is a translation. */
  textEn?: string | null;
  lang: Lang;
  /** false when the stream aborted or errored part-way through. */
  complete: boolean;
  meta: RecordMeta;
}

/**
 * Record the prose reading of a decision. One per decision, keyed
 * a_<decisionId>, so re-asking replaces rather than appends. Written after the
 * stream has already been delivered, and never throws.
 */
export async function recordAdvice(input: AdviceInput): Promise<boolean> {
  try {
    const { receipt } = input;
    await setDoc(doc(db, "advice", `a_${receipt.id}`), {
      decisionId: receipt.id,
      advisedAt: serverTimestamp(),
      /** The text shown to the reader — Bangla when they wrote Bangla. */
      text: input.text.slice(0, 2000),
      /** Always the English, so the narrative can be studied and compared
       *  across languages without first having to detect one. */
      textEn: input.textEn?.slice(0, 2000) ?? null,
      lang: input.lang,
      complete: input.complete,
      model: receipt.model,
      answerCount: receipt.answerCount,
      answerTypes: receipt.answerTypes,
      meanConfidence: receipt.meanConfidence,
      meta: {
        ipHash: hashIp(input.meta.ip),
        userAgent: input.meta.userAgent.slice(0, 300),
        referer: input.meta.referer.slice(0, 500),
      },
    });
    return true;
  } catch (e) {
    console.error("[firestore] recordAdvice failed:", e);
    return false;
  }
}

export interface RatingInput {
  receipt: ReceiptPayload;
  score: number;
  comment?: string;
  timeToRateMs: number;
  meta: RecordMeta;
}

/**
 * Record a rating against a decision.
 *
 * Written with a deterministic document id (`r_<decisionId>`) so re-rating
 * overwrites rather than appending, and so one response cannot accumulate an
 * unbounded number of ratings. The trade-off: because the rules deny reads, we
 * cannot open a transaction to preserve the original timestamp, so `ratedAt`
 * always reflects the most recent rating. `decisions.createdAt` remains the
 * authoritative decision time.
 *
 * Never throws — a failed rating must not surface as an error to the user.
 * Returns true when the write landed.
 */
export async function recordRating(input: RatingInput): Promise<boolean> {
  try {
    const { receipt } = input;
    await setDoc(doc(db, "ratings", `r_${receipt.id}`), {
      decisionId: receipt.id,
      ratedAt: serverTimestamp(),
      score: input.score,
      comment: input.comment?.trim() ? input.comment.trim().slice(0, 600) : null,

      // Server-derived, carried inside the signed receipt — never from the browser.
      model: receipt.model,
      answerCount: receipt.answerCount,
      answerTypes: receipt.answerTypes,
      meanConfidence: receipt.meanConfidence,
      peakProbability: receipt.peakProbability,

      meta: {
        ipHash: hashIp(input.meta.ip),
        userAgent: input.meta.userAgent.slice(0, 300),
        referer: input.meta.referer.slice(0, 500),
        timeToRateMs: Math.round(input.timeToRateMs),
      },
    });
    return true;
  } catch (e) {
    console.error("[firestore] recordRating failed:", e);
    return false;
  }
}
