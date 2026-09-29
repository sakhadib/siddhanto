import { NextRequest } from "next/server";
import { z } from "zod";
import type { Answer } from "@/lib/jev";
import { questionSchema } from "@/lib/validate";
import { AdviseError, streamAdvise } from "@/lib/advise";
import { ADVISE_ERR } from "@/lib/advise-protocol";
import { hashAnswers, verifyReceipt } from "@/lib/receipt";
import { recordAdvice } from "@/lib/firestore";
import { checkRateLimit, RATE_POLICY } from "@/lib/ratelimit";

export const runtime = "nodejs";
// The upstream call can take a while to emit its first token.
export const maxDuration = 60;

const MAX_STATE = 1200;
const MAX_QUESTIONS = 10;

const adviseRequestSchema = z.object({
  receipt: z.string().min(40).max(2000),
  state: z.string().trim().min(1).max(MAX_STATE),
  questions: z.array(questionSchema).min(1).max(MAX_QUESTIONS),
  answers: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/advise
 *
 * Streams a short reading of what JEV's output means, as plain text deltas.
 * The browser receives no model identity — the name lives only in
 * lib/advise.ts, which no client component imports.
 *
 * The receipt is re-verified and the submitted answers must hash to the value
 * the receipt was minted with, so the narrative recorded against a decision
 * provably describes that decision's real output rather than whatever the
 * browser chose to send.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "";
  const referer = req.headers.get("referer") ?? "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = adviseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const rl = checkRateLimit(ip, RATE_POLICY);
  if (!rl.allowed) return Response.json({ error: rl.reason }, { status: 429 });

  const verdict = verifyReceipt(parsed.data.receipt);
  if (!verdict.ok) return Response.json({ error: verdict.reason }, { status: 403 });

  const answers = parsed.data.answers as Record<string, Answer>;
  if (hashAnswers(answers) !== verdict.payload.answersHash) {
    return Response.json(
      { error: "Answers do not match the recorded decision" },
      { status: 403 }
    );
  }

  const encoder = new TextEncoder();
  const state = parsed.data.state;
  const questions = parsed.data.questions;
  let full = "";
  let failed = false;
  let aborted = false;
  req.signal.addEventListener("abort", () => {
    aborted = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamAdvise(state, questions, answers)) {
          if (aborted) break;
          full += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (e) {
        // The stream has already begun, so the status code is long gone.
        // Surface the failure in-band; the client strips the sentinel.
        failed = true;
        const msg =
          e instanceof AdviseError ? e.message : "The reading layer is unavailable.";
        console.error("[advise] stream failed:", e);
        if (!aborted) controller.enqueue(encoder.encode(ADVISE_ERR + msg));
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed by a client disconnect */
        }
        // Persist whatever was produced, including a partial paragraph — a
        // truncated reading is still a signal about the decision.
        if (full.trim()) {
          await recordAdvice({
            receipt: verdict.payload,
            text: full.trim().slice(0, 2000),
            complete: !failed && !aborted,
            meta: { ip, userAgent, referer, timeOnFormMs: 0 },
          });
        }
      }
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
