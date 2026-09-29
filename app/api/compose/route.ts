import { NextRequest, NextResponse } from "next/server";
import { composeDraft, composeRequestSchema, ComposeError } from "@/lib/compose";
import { checkRateLimit, type LimitPolicy } from "@/lib/ratelimit";

export const runtime = "nodejs";

/* Drafting is a model call but far cheaper than JEV, and it happens before
   the author has committed to anything, so it gets a wider leash than a
   decision. It is still the costliest free action on the page. */
const COMPOSE_POLICY: LimitPolicy = { perHour: 20, perDay: 80, label: "draft" };

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req), COMPOSE_POLICY);
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.reason }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = composeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Deliberately not stored. This is scratch work the author has not
  // committed to, and a draft would be the least meaningful text in the
  // collection to retain.
  try {
    const draft = await composeDraft(parsed.data);
    return NextResponse.json(draft);
  } catch (e) {
    const status = e instanceof ComposeError ? e.status : 500;
    if (status >= 500) console.error("[compose] drafting failed:", e);
    return NextResponse.json(
      {
        error:
          status === 429
            ? e instanceof ComposeError
              ? e.message
              : "Too many drafts."
            : "Could not turn that into a form. Try describing it again, or fill the form yourself.",
      },
      { status: status === 429 ? 429 : 502 }
    );
  }
}
