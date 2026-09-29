import https from "node:https";
import type { Question } from "./validate";
import type { Lang } from "./lang";

/* ==========================================================================
   Translation, for when the author writes Bangla and JEV only reads English.

   SERVER ONLY — the model name must never reach the client bundle.

   Non-streaming by design. A translation is a single all-or-nothing rewrite,
   and streaming one is both slower and produces visibly broken output where
   Bangla words arrive out of order against their English source.

   The whole submission is translated in ONE call rather than per field: a
   four-question form would otherwise cost five round trips before JEV is even
   reached, and this is on the critical path to the user's numbers.
   ========================================================================== */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stealth/space-bunny-alpha";

const SYSTEM = `You are a translator. You convert between Bangla (bn) and English (en) and you do nothing else.

You will be given a JSON object containing only string values that need translating, plus a direction.

Rules:
- Return a single JSON object with exactly the same keys and the same structure as the input, with every string value translated.
- Translate meaning, not words. Produce natural, idiomatic text in the target language, not a transliteration.
- Preserve numbers, units, currency, proper nouns and technical terms. Keep a proper noun untranslated if translating it would obscure it.
- If a string is already in the target language, return it unchanged.
- Never add commentary, explanation, apology or preamble. Output only the JSON object.
- Preserve markdown emphasis markers if present.`;

export class TranslateError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "TranslateError";
  }
}

/** Collect every user-authored string, keyed by a stable path. */
function flatten(state: string, questions: Question[]) {
  const out: Record<string, string> = { state };
  questions.forEach((q, i) => {
    out[`q${i}.instructions`] = q.instructions;
    if (q.type === "noul") {
      if (q.criteria?.true) out[`q${i}.criteria.true`] = q.criteria.true;
      if (q.criteria?.false) out[`q${i}.criteria.false`] = q.criteria.false;
    } else if (q.type === "choice") {
      q.criteria.forEach((c, j) => {
        out[`q${i}.opt${j}.label`] = c.label;
        if (c.description) out[`q${i}.opt${j}.description`] = c.description;
      });
    } else {
      q.criteria.forEach((lv, j) => {
        out[`q${i}.level${j}`] = lv;
      });
    }
  });
  return out;
}

/** Rebuild the state/questions from a translated flat map. */
function unflatten(
  parts: Record<string, string>,
  questions: Question[]
): { state: string; questions: Question[] } {
  const get = (k: string, fallback: string) => {
    const v = parts[k];
    return typeof v === "string" && v.trim() ? v : fallback;
  };

  return {
    state: get("state", ""),
    questions: questions.map((q, i) => {
      const instructions = get(`q${i}.instructions`, q.instructions);
      if (q.type === "noul") {
        const t = parts[`q${i}.criteria.true`];
        const f = parts[`q${i}.criteria.false`];
        return {
          ...q,
          instructions,
          ...(t || f ? { criteria: { ...(t ? { true: t } : {}), ...(f ? { false: f } : {}) } } : {}),
        };
      }
      if (q.type === "choice") {
        return {
          ...q,
          instructions,
          criteria: q.criteria.map((c, j) => ({
            label: get(`q${i}.opt${j}.label`, c.label),
            ...(parts[`q${i}.opt${j}.description`]
              ? { description: parts[`q${i}.opt${j}.description`] }
              : {}),
          })),
        };
      }
      return {
        ...q,
        instructions,
        criteria: q.criteria.map((lv, j) => get(`q${i}.level${j}`, lv)),
      };
    }),
  };
}

function postJson(body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(ENDPOINT);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        family: 4, // this host has broken IPv6 routing
        timeout: 60_000,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new TranslateError(status, `translate upstream ${status}: ${text.slice(0, 200)}`));
            return;
          }
          resolve(text);
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("translate timed out")));
    req.write(body);
    req.end();
  });
}

async function callModel(parts: Record<string, string>, to: Lang): Promise<Record<string, string>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new TranslateError(500, "OPENROUTER_API_KEY is not configured");

  const body = JSON.stringify({
    model: MODEL,
    stream: false,
    temperature: 0,
    // The reading model is a reasoning model, and its reasoning tokens count
    // against this budget even on a non-streaming call. 220 was not enough —
    // it returned an empty completion. A translated form runs ~400 tokens.
    max_tokens: 2000,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Translate every string value into ${to === "bn" ? "Bangla (bn)" : "English (en)"}.\n\nInput:\n${JSON.stringify(parts)}`,
      },
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
    const json = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
    };
    content = json.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new TranslateError(502, "Unreadable translation response");
  }
  if (!content.trim()) throw new TranslateError(502, "Translation model returned nothing");

  // Models wrap JSON in fences or prose despite instructions. Take the
  // outermost object rather than trusting the wrapper.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new TranslateError(502, "Translation model returned no JSON object");
  }
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, string>;
    if (typeof parsed !== "object" || parsed === null) {
      throw new TranslateError(502, "Translation model returned a non-object");
    }
    return parsed;
  } catch (e) {
    if (e instanceof TranslateError) throw e;
    throw new TranslateError(502, "Could not parse the translated JSON");
  }
}

/**
 * Translate a whole submission into `to`. Every user-authored string in one
 * call. Throws rather than falling back to the original: silently handing
 * Bangla to an English-only model would produce confident nonsense, which is
 * far worse than a visible failure.
 */
export async function translateSubmission(
  state: string,
  questions: Question[],
  to: Lang
): Promise<{ state: string; questions: Question[] }> {
  const parts = flatten(state, questions);
  const translated = await callModel(parts, to);
  return unflatten(translated, questions);
}

/** Translate one piece of prose — used for the Reading. */
export async function translateText(text: string, to: Lang): Promise<string> {
  const out = await callModel({ text }, to);
  const v = out.text;
  if (typeof v !== "string" || !v.trim()) {
    throw new TranslateError(502, "Translation model returned no text");
  }
  return v;
}
