import https from "node:https";
import { z } from "zod";
import { LIMITS, questionSchema } from "./validate";
import type { Question } from "./validate";

/* ==========================================================================
   Drafting the form from plain speech.

   SERVER ONLY — the model name must never reach the client bundle.

   This is the one place where a second model reads the author's words BEFORE
   JEV does, so it matters that it cannot answer. It emits a form and nothing
   else; the numbers still come from JEV, and the author still has to press
   Decide. Treat the draft as a proposal, not a result.

   Non-streaming. A draft has to arrive whole or not at all — a form that fills
   in progressively is a form the author edits against a moving target, and
   they are meant to review it before it is used.
   ========================================================================== */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stealth/space-bunny-alpha";

/** Mirrors the submission schema. A draft that cannot survive this is not
 *  worth showing, so it fails at the boundary instead of in the form. */
const draftSchema = z.object({
  state: z.string().trim().min(1).max(LIMITS.stateMax),
  questions: z.array(questionSchema).min(1).max(LIMITS.questionsMax),
});

export type Draft = z.infer<typeof draftSchema>;

export const composeRequestSchema = z.object({
  /** The conversation so far, oldest first. Sent whole so a follow-up like
   *  "make the second one a 1-10 scale" revises the right question. */
  messages: z.array(z.string().trim().min(1).max(2000)).min(1).max(8),
  /** The form as it currently stands, so a follow-up edits it rather than
   *  starting over. */
  current: z
    .object({
      state: z.string().max(LIMITS.stateMax),
      questions: z.array(questionSchema).max(LIMITS.questionsMax),
    })
    .nullish(),
});

export type ComposeRequest = z.infer<typeof composeRequestSchema>;

export class ComposeError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ComposeError";
  }
}

const SYSTEM = `You turn what a person describes in ordinary language into a structured decision form. You do not answer the form. You never state a probability, a verdict, or a recommendation.

Output a single JSON object and nothing else — no prose, no explanation, no code fence.

{
  "state": "the situation, as one self-contained brief",
  "questions": [
    { "type": "choice", "instructions": "a question with mutually exclusive options", "criteria": [{ "label": "option" }] },
    { "type": "score",  "instructions": "a question answered on an ordered scale", "criteria": ["lowest", "highest"] },
    { "type": "noul",   "instructions": "a yes/no question", "criteria": { "true": "what true looks like", "false": "what false looks like" } }
  ]
}

Choosing a type:
- "choice" when the person named concrete alternatives, categories, or outcomes they want weighed against each other.
- "score" when the quantity is continuous or they gave a range or scale. Use 3-7 levels, ordered, and make the endpoints the extremes actually being asked about. Never invent a midpoint number like 5 out of 10 unless they asked for one.
- "noul" only for a genuine yes/no.

Rules:
- Write the state so it makes sense to someone who has never seen the conversation. Resolve "it", "she", "the seller", "this app" to the actual thing. Include the numbers they gave — amounts, dates, counts, model names — because they are the substance. Drop pleasantries and narration of the conversation.
- Ask only what the situation raises. A form is not better for being long. Two well-chosen questions beat five padded ones, and if they only raised one thing, ask one.
- Never answer a question you write, and never let the option labels imply an outcome. "Scam" and "Safe" are fine as options; "Which is it?" is not a question you may ask, because the answer is the whole job.
- Keep the person's own language. If they wrote Bangla, write the state, the instructions and the option labels in Bangla. Do not translate to English.
- Option labels are short: a few words each, not sentences.
- Make the questions answerable from the state alone. Nothing may depend on information the state does not contain.`;

function postJson(body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(ENDPOINT);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        family: 4, // this host has broken IPv6 routing
        timeout: 90_000,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new ComposeError(status, `compose upstream ${status}: ${text.slice(0, 200)}`));
            return;
          }
          resolve(text);
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("compose timed out")));
    req.write(body);
    req.end();
  });
}

/**
 * Draft a form from the conversation. Returns a proposal only — the caller
 * hands it to the author to edit. Throws rather than guessing: a malformed
 * draft is worse than a visible failure, because the author cannot review
 * something they were never shown.
 */
export async function composeDraft(req: ComposeRequest): Promise<Draft> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new ComposeError(500, "OPENROUTER_API_KEY is not configured");

  const transcript = req.messages
    .map((m, i) => `Message ${i + 1}:\n${m}`)
    .join("\n\n");

  const userContent = req.current
    ? `${transcript}\n\nThe form currently reads:\n${JSON.stringify(req.current)}\n\nReturn the form as it should read after taking these messages into account. Keep what still applies; change only what the latest messages ask for.`
    : `${transcript}\n\nReturn the form this situation calls for.`;

  const body = JSON.stringify({
    model: MODEL,
    stream: false,
    // Low but not zero: the job is to shape what the author said, not to
    // retrieve it, and a hair of latitude is what makes the state read like a
    // brief instead of a transcript.
    temperature: 0.3,
    // Same reasoning-model caveat as translation: reasoning tokens count, and
    // a 1200-word state plus five questions needs room.
    max_tokens: 2500,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  const text = await postJson(body, {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://siddhanto.local",
    "X-Title": "Siddhanto",
  });

  let content = "";
  try {
    const json = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    content = json.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new ComposeError(502, "Unreadable draft response");
  }
  if (!content.trim()) throw new ComposeError(502, "The drafting model returned nothing");

  // Models wrap JSON in fences or prose despite instructions. Take the
  // outermost object rather than trusting the wrapper.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new ComposeError(502, "The drafting model returned no JSON object");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new ComposeError(502, "Could not parse the drafted form");
  }

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
      .slice(0, 400);
    throw new ComposeError(502, `The drafted form did not match the schema — ${detail}`);
  }

  return { state: parsed.data.state, questions: parsed.data.questions as Question[] };
}
