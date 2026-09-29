import { NextRequest, NextResponse } from "next/server";
import { decideRequestSchema, type DecideRequest } from "@/lib/validate";
import { callJev, JevError } from "@/lib/jev";
import { recordDecision } from "@/lib/firestore";
import { checkRateLimit, DECIDE_POLICY } from "@/lib/ratelimit";
import { hashPrompt, mintReceipt, summariseAnswers } from "@/lib/receipt";
import { detectFromParts } from "@/lib/lang";
import { translateSubmission, TranslateError } from "@/lib/translate";

export const runtime = "nodejs";

const MIN_TIME_ON_FORM_MS = 2000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const referer = req.headers.get("referer") ?? "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = decideRequestSchema.safeParse(body);
  const timeOnFormMs =
    typeof body === "object" && body !== null && "meta" in body
      ? (body as { meta?: { timeOnFormMs?: number } }).meta?.timeOnFormMs ?? 0
      : 0;
  const honeypot =
    typeof body === "object" && body !== null && "meta" in body
      ? (body as { meta?: { honeypot?: string } }).meta?.honeypot ?? ""
      : "";

  // 1. Honeypot: silently fake-success, record the attempt, never call JEV.
  if (honeypot) {
    await recordDecision(parsed.success ? parsed.data : null, null, {
      ip, userAgent, referer, timeOnFormMs, flagged: "honeypot",
    });
    return NextResponse.json({ ok: true });
  }

  // 2. Too-fast submission: almost certainly scripted.
  if (timeOnFormMs < MIN_TIME_ON_FORM_MS) {
    await recordDecision(parsed.success ? parsed.data : null, null, {
      ip, userAgent, referer, timeOnFormMs, flagged: "too-fast",
    });
    return NextResponse.json({ error: "Submission rejected." }, { status: 400 });
  }

  // 3. Rate limit.
  const rl = checkRateLimit(ip, DECIDE_POLICY);
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 });
  }

  // 4. Validate.
  if (!parsed.success) {
    await recordDecision(null, null, { ip, userAgent, referer, timeOnFormMs },
      { stage: "validate", message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 500) });
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 }
    );
  }

  // 5. JEV reads English only. If the author wrote Bangla, translate the
  //    whole submission first — one call, inside this request, so the client
  //    cannot influence what the model actually reads. The original is kept
  //    for storage; English is what gets sent and what gets hashed.
  const submitted = parsed.data;
  const sourceLang = detectFromParts([
    submitted.state,
    ...submitted.questions.map((q) =>
      q.type === "choice"
        ? [q.instructions, ...q.criteria.map((c) => c.label)].join(" ")
        : q.type === "score"
          ? [q.instructions, ...q.criteria].join(" ")
          : [q.instructions, q.criteria?.true ?? "", q.criteria?.false ?? ""].join(" "),
    ),
  ]);

  let working: DecideRequest = { state: submitted.state, questions: submitted.questions, meta: submitted.meta };
  if (sourceLang === "bn") {
    try {
      const en = await translateSubmission(submitted.state, submitted.questions, "en");
      working = { state: en.state, questions: en.questions, meta: submitted.meta };
    } catch (e) {
      const msg = e instanceof TranslateError ? e.message : "Translation failed";
      console.error("[decide] translate-in failed:", e);
      await recordDecision(null, null, { ip, userAgent, referer, timeOnFormMs },
        { stage: "translate", message: msg.slice(0, 500) });
      return NextResponse.json(
        { error: "Could not translate the Bangla submission into English. Please try again, or write the question in English." },
        { status: 502 }
      );
    }
  }

  // 6. Call JEV, record, respond.
  try {
    const jev = await callJev(working);
    const decisionId = await recordDecision(working, jev, { ip, userAgent, referer, timeOnFormMs }, null,
      sourceLang === "bn"
        ? { lang: sourceLang, state: submitted.state, questions: submitted.questions }
        : null
    );

    // Mint a signed receipt so this response can be rated later. The summary it
    // carries is derived here from the JEV response, so the ratings collection
    // is self-sufficient for calibration research. If minting fails (no
    // RATING_SECRET configured) the decision still stands — just not rateable.
    let receipt: string | undefined;
    if (decisionId) {
      try {
        receipt = mintReceipt(
          summariseAnswers(
            jev.model,
            decisionId,
            jev.answers,
            sourceLang,
            hashPrompt(working.state, working.questions)
          )
        );
      } catch (e) {
        console.error("[decide] could not mint rating receipt:", e);
      }
    }

    return NextResponse.json({
      model: jev.model,
      answers: jev.answers,
      usage: jev.usage,
      ...(receipt ? { receipt } : {}),
      // The English text the model saw. The client needs it to build the
      // Reading prompt and to map JEV's answer keys back to the labels the
      // author actually typed.
      ...(sourceLang === "bn" ? { lang: sourceLang, stateEn: working.state, questionsEn: working.questions } : {}),
    });
  } catch (e) {
    const status = e instanceof JevError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[decide] JEV call failed:", e);
    await recordDecision(working, null, { ip, userAgent, referer, timeOnFormMs },
      { stage: "jev", message: message.slice(0, 500) });
    return NextResponse.json({ error: "Decision engine unavailable. Please try again." }, { status: status >= 500 ? 502 : status });
  }
}
