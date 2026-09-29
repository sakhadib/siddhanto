import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { createHash } from "crypto";
import { db } from "@/firebase";
import type { DecideRequest } from "./validate";
import type { JevResponse } from "./jev";

export interface RecordMeta {
  ip: string;
  userAgent: string;
  referer: string;
  timeOnFormMs: number;
  flagged?: string; // "honeypot" | "too-fast" | undefined for clean submissions
}

function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "siddhanto-mvp-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24);
}

/**
 * Record a submission to the funnel. Never throws — recording failure must not
 * break the user's decision flow.
 */
export async function recordDecision(
  req: DecideRequest | null,
  jev: JevResponse | null,
  meta: RecordMeta,
  error: { stage: string; message: string } | null = null
): Promise<void> {
  try {
    await addDoc(collection(db, "decisions"), {
      createdAt: serverTimestamp(),
      state: req?.state ?? null,
      questions: req?.questions ?? null,
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
  } catch (e) {
    console.error("[firestore] recordDecision failed:", e);
  }
}
