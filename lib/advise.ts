import https from "node:https";
import type { Answer } from "./jev";
import type { Question } from "./validate";

/* ==========================================================================
   The reading layer: a chat model that turns JEV's calibrated output into a
   short piece of prose.

   SERVER ONLY. The model identity is never sent to the browser — the route
   streams plain text deltas, so the name exists only in this module and in
   the build. Nothing here may be imported by a client component.

   The model is asked to interpret, not instruct. Siddhanto's premise is that
   it declines to tell you what to do; a model that starts issuing directives
   would contradict the thing the product is built around, and would be the
   least defensible part of the page if it were ever wrong.
   ========================================================================== */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "stealth/space-bunny-alpha";

const SYSTEM = `You are the reading layer of a decision instrument. You are given a situation someone described in their own words, the structured queries they asked about it, and the calibrated output of a decision model.

Your job is to say what the numbers mean.

Rules:
- Interpret, never instruct. Describe what the output implies and what it turns on. Do not tell the reader what to do, what to choose, or which option to pick.
- Never name yourself, this model, any other model, product or vendor. Do not refer to yourself in the first person and do not open by acknowledging that you are an AI.
- Do not recite the numbers back as a list. Interpret them; the reader can already see them.
- Do not hedge reflexively and do not add a disclaimer about your own limitations. If the output is genuinely thin, say what is thin about it.
- Three to five sentences. One short paragraph.
- Plain prose. You may use **bold** or *emphasis* sparingly where it genuinely helps. No headings, no bullet lists, no emoji.`;

function describeAnswer(a: Answer): string {
  if (a.type === "noul") {
    return `probability the statement is true = ${(a.noul * 100).toFixed(1)}%`;
  }
  if (a.type === "choice") {
    const dist = Object.entries(a.probabilities)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
      .join(", ");
    return `selected option "${a.choice}"; distribution: ${dist}; distribution-level confidence ${(a.confidence * 100).toFixed(0)}%`;
  }
  const mass = Object.entries(a.probabilities)
    .sort((x, y) => Number(x[0]) - Number(y[0]))
    .map(([k, v]) => `level ${k} ${(v * 100).toFixed(1)}%`)
    .join(", ");
  const legend = Object.entries(a.legend)
    .sort((x, y) => Number(x[0]) - Number(y[0]))
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ");
  return `expected score ${a.score.toFixed(3)} on a scale where levels are [${legend}]; mass: ${mass}; distribution-level confidence ${(a.confidence * 100).toFixed(0)}%`;
}

export function buildAdviseMessages(
  state: string,
  questions: Question[],
  answers: Record<string, Answer>
): { role: "system" | "user"; content: string }[] {
  const lines = questions.map((q, i) => {
    const a = answers[`q${i}`];
    const question =
      q.type === "noul"
        ? `statement to judge: "${q.instructions}"`
        : q.type === "choice"
          ? `question: "${q.instructions}" options: ${q.criteria.map((c) => c.label).join(", ")}`
          : `question: "${q.instructions}" scale: ${q.criteria.map((c, k) => `${k}=${c}`).join("; ")}`;
    return `${i + 1}. ${question}\n   model output: ${a ? describeAnswer(a) : "none returned"}`;
  });

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Situation:\n"""\n${state}\n"""\n\nQueries and the model's output for each:\n${lines.join("\n")}\n\nSay what this means.`,
    },
  ];
}

interface RawResponse {
  status: number;
  stream: NodeJS.ReadableStream & AsyncIterable<Buffer | string>;
}

/** POST with IPv4 forced — the dev host has broken IPv6 routing, and global
 *  fetch/undici tries AAAA records and dies with ETIMEDOUT. */
function postStream(
  body: string,
  headers: Record<string, string>
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(ENDPOINT);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        family: 4,
        timeout: 60_000,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => reject(new Error(`upstream ${status}: ${text.slice(0, 300)}`)));
          res.destroy();
          return;
        }
        resolve({ status, stream: res });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("upstream timed out")));
    req.write(body);
    req.end();
  });
}

/** Extract the content delta from one SSE frame, or null. */
function parseFrame(frame: string): string | null {
  const line = frame
    .split("\n")
    .find((l) => l.startsWith("data:"));
  if (!line) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const json = JSON.parse(payload) as {
      choices?: { delta?: { content?: string } }[];
    };
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null; // keep-alive or a frame we do not care about
  }
}

export class AdviseError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "AdviseError";
  }
}

/** Yield the advice as it is produced. */
export async function* streamAdvise(
  state: string,
  questions: Question[],
  answers: Record<string, Answer>
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AdviseError(500, "OPENROUTER_API_KEY is not configured");

  const body = JSON.stringify({
    model: MODEL,
    stream: true,
    temperature: 0.3,
    // The reading model is a reasoning model: it streams `delta.reasoning`
    // with an empty `delta.content` while it thinks, and those tokens count
    // against max_tokens. At 220 it regularly spent the whole budget
    // reasoning and emitted no visible text at all, which surfaced as an
    // empty 200 the user saw as "Reading" followed by nothing. The budget has
    // to cover reasoning plus a three-to-five sentence answer.
    max_tokens: 1500,
    messages: buildAdviseMessages(state, questions, answers),
  });

  const res = await postStream(body, {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://siddhanto.local",
    "X-Title": "Siddhanto",
  });

  let buffer = "";
  for await (const chunk of res.stream as AsyncIterable<Buffer | string>) {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const delta = parseFrame(frame);
      if (delta) yield delta;
    }
  }
}
