import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Answer } from "./jev";
import { RATING_LIMITS, type ReceiptPayload } from "./rating";
import type { Lang } from "./lang";

/* ==========================================================================
   Signed receipts. A mini-JWT: base64url(payload).hmac.

   Purpose: /api/rate must be able to trust that a receipt was minted for a
   decision this server actually returned, that it has not been altered, and
   that the summary figures it carries (answer types, mean confidence, peak
   probability) came from the JEV response rather than from the browser.
   Without this, anyone could post ratings against arbitrary decision ids
   with arbitrary metadata and poison the research set.

   SERVER ONLY — uses node:crypto and reads a secret from the environment.
   ========================================================================== */

function secret(): string {
  const s = process.env.RATING_SECRET;
  if (!s || s.length < 16) {
    // Deliberately no hardcoded fallback: a shipped default secret would make
    // every forged rating look authentic. Fail loudly instead.
    throw new Error("RATING_SECRET is not configured (need >= 16 chars)");
  }
  return s;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Derive the research summary from the answers the model actually returned. */
/** Stable hash of the answers object, so a later request can prove it is
 *  carrying the same model output the receipt was minted for. */
export function hashAnswers(answers: Record<string, Answer>): string {
  return createHash("sha256").update(JSON.stringify(answers)).digest("hex");
}

/** Stable hash of the English state + questions the Reading is built from. */
export function hashPrompt(state: string, questions: unknown): string {
  return createHash("sha256").update(JSON.stringify([state, questions])).digest("hex");
}

export function summariseAnswers(
  model: string,
  id: string,
  answers: Record<string, Answer>,
  sourceLang: Lang = "en",
  promptHash = ""
) {
  const list = Object.values(answers);
  const answerTypes = list.map((a) => a.type);

  const confidences = list
    .map((a) => (a.type === "noul" ? null : a.confidence))
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));
  const meanConfidence = confidences.length
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : null;

  let peak: number | null = null;
  for (const a of list) {
    if (a.type !== "choice") continue;
    for (const p of Object.values(a.probabilities)) {
      if (Number.isFinite(p) && (peak === null || p > peak)) peak = p;
    }
  }

  const payload: ReceiptPayload = {
    id,
    sourceLang,
    promptHash,
    answersHash: hashAnswers(answers),
    model,
    issuedAt: Date.now(),
    answerCount: list.length,
    answerTypes,
    meanConfidence,
    peakProbability: peak,
  };
  return payload;
}

export function mintReceipt(payload: ReceiptPayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export type VerifyResult =
  | { ok: true; payload: ReceiptPayload }
  | { ok: false; reason: string };

export function verifyReceipt(receipt: string): VerifyResult {
  const dot = receipt.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "Malformed receipt" };

  const body = receipt.slice(0, dot);
  const mac = receipt.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(body);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Signing unavailable" };
  }

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid receipt signature" };
  }

  let payload: ReceiptPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ReceiptPayload;
  } catch {
    return { ok: false, reason: "Unreadable receipt payload" };
  }

  if (typeof payload?.id !== "string" || !/^[A-Za-z0-9]{8,40}$/.test(payload.id)) {
    return { ok: false, reason: "Receipt is missing a valid decision id" };
  }
  if (payload.sourceLang !== "en" && payload.sourceLang !== "bn") {
    return { ok: false, reason: "Receipt is missing a valid source language" };
  }
  if (typeof payload.promptHash !== "string" || !/^[0-9a-f]{64}$/.test(payload.promptHash)) {
    return { ok: false, reason: "Receipt is missing a valid prompt hash" };
  }
  if (typeof payload.answersHash !== "string" || !/^[0-9a-f]{64}$/.test(payload.answersHash)) {
    return { ok: false, reason: "Receipt is missing a valid answers hash" };
  }
  if (
    typeof payload.issuedAt !== "number" ||
    Date.now() - payload.issuedAt > RATING_LIMITS.receiptTtlMs
  ) {
    return { ok: false, reason: "Receipt has expired" };
  }

  return { ok: true, payload };
}
