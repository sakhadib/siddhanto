import https from "node:https";
import type { DecideRequest } from "./validate";

// JEV contract — see knowledge.md. Endpoint: OpenRouter decisions API.
const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
const JEV_MODEL = "typesafe/jev-1.13";

export interface NoulAnswer {
  type: "noul";
  noul: number; // calibrated probability the statement is true; no confidence
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string; // winning option key
  probabilities: Record<string, number>; // sums to 1
  confidence: number; // 0–1, distribution-level (NOT winner probability)
}

export interface ScoreAnswer {
  type: "score";
  score: number; // expected value over zero-based indices, Σ i·pᵢ (may be fractional)
  legend: Record<string, string>; // index -> level description
  probabilities: Record<string, number>;
  confidence: number;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface JevUsage {
  input_tokens: number;
  output_tokens: number;
  cost?: number;
}

export interface JevResponse {
  model: string; // dated build, e.g. typesafe/jev-1.13-20260917
  answers: Record<string, Answer>;
  usage: JevUsage;
  id?: string;
  provider?: string;
}

type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true?: string; false?: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "score"; instructions: string; criteria: string[] };

/** Convert our validated request into the JEV payload shape (knowledge.md §3–4). */
export function buildJevPayload(req: DecideRequest) {
  const questions: Record<string, JevQuestion> = {};

  req.questions.forEach((q, i) => {
    const id = `q${i}`;
    if (q.type === "noul") {
      const criteria =
        q.criteria && (q.criteria.true || q.criteria.false)
          ? { ...(q.criteria.true ? { true: q.criteria.true } : {}), ...(q.criteria.false ? { false: q.criteria.false } : {}) }
          : undefined;
      questions[id] = { type: "noul", instructions: q.instructions, ...(criteria ? { criteria } : {}) };
    } else if (q.type === "choice") {
      const criteria: Record<string, string | null> = {};
      for (const opt of q.criteria) criteria[opt.label] = opt.description || null;
      questions[id] = { type: "choice", instructions: q.instructions, criteria };
    } else {
      questions[id] = { type: "score", instructions: q.instructions, criteria: q.criteria };
    }
  });

  return { model: JEV_MODEL, state: req.state, questions };
}

export class JevError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "JevError";
  }
}

/**
 * POST JSON forcing IPv4 (family: 4). The dev host has broken IPv6 routing —
 * global fetch/undici tries AAAA records and dies with ETIMEDOUT.
 */
function postJson(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        family: 4,
        timeout: 30_000,
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("JEV request timed out")));
    req.write(body);
    req.end();
  });
}

export async function callJev(req: DecideRequest): Promise<JevResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new JevError(500, "OPENROUTER_API_KEY is not configured");

  const res = await postJson(
    JEV_ENDPOINT,
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://siddhanto.local",
      "X-Title": "Siddhanto",
    },
    JSON.stringify(buildJevPayload(req))
  );

  if (res.status < 200 || res.status >= 300) {
    throw new JevError(res.status, `JEV request failed (${res.status}): ${res.text.slice(0, 300)}`);
  }

  return JSON.parse(res.text) as JevResponse;
}
