import { NextRequest, NextResponse } from "next/server";
import { ratingRequestSchema } from "@/lib/rating";
import { verifyReceipt } from "@/lib/receipt";
import { recordRating } from "@/lib/firestore";
import { checkRateLimit, RATE_POLICY } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * POST /api/rate
 *
 * Accepts a 1–5 usefulness rating and an optional comment for one decision.
 * The client sends back the opaque receipt it received from /api/decide; the
 * summary figures stored alongside the rating come from inside that signed
 * receipt, so nothing descriptive can be forged from the browser.
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ratingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid rating",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }

  // Rate limit before any write, including before the crypto work.
  const rl = checkRateLimit(ip, RATE_POLICY);
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 });
  }

  const verdict = verifyReceipt(parsed.data.receipt);
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.reason }, { status: 403 });
  }

  const saved = await recordRating({
    receipt: verdict.payload,
    score: parsed.data.score,
    comment: parsed.data.comment,
    timeToRateMs: parsed.data.meta.timeToRateMs,
    meta: { ip, userAgent, referer, timeOnFormMs: 0 },
  });

  if (!saved) {
    // Recording failed. Say so plainly rather than pretending it landed, but
    // do not surface a scary error to the user — the rating is optional.
    return NextResponse.json({ error: "Could not record the rating." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
