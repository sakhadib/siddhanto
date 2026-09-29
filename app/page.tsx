"use client";

import { useRef, useState } from "react";
import { LIMITS, type Question } from "@/lib/validate";
import type { Answer, JevUsage } from "@/lib/jev";
import ResultPanel from "@/components/ResultPanel";

type DraftQuestion =
  | { type: "noul"; instructions: string; criteria: { true?: string; false?: string } }
  | { type: "choice"; instructions: string; criteria: { label: string; description?: string }[] }
  | { type: "score"; instructions: string; criteria: string[] };

const QUESTION_TYPES = ["noul", "score", "choice"] as const;

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-base text-zinc-900 placeholder-zinc-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";

function emptyQuestion(type: DraftQuestion["type"]): DraftQuestion {
  if (type === "choice")
    return { type, instructions: "", criteria: [{ label: "" }, { label: "" }] };
  if (type === "score") return { type, instructions: "", criteria: ["", ""] };
  return { type, instructions: "", criteria: {} };
}

interface ApiResult {
  model: string;
  answers: Record<string, Answer>;
  usage?: JevUsage;
}

export default function Home() {
  const [state, setState] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion("noul")]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const mountedAt = useRef(Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  function updateQuestion(i: number, q: DraftQuestion) {
    setQuestions((qs) => qs.map((old, j) => (j === i ? q : old)));
  }

  async function decide() {
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          questions: questions as Question[],
          meta: {
            timeOnFormMs: Date.now() - mountedAt.current,
            honeypot: honeypotRef.current?.value ?? "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = data.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join(" · ");
        throw new Error(issues || data.error || `Request failed (${res.status})`);
      }
      setResult(data);
      // On mobile the results are below the fold — scroll to them
      if (window.innerWidth < 1024) {
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left column: input */}
      <div className="space-y-6">
        {/* State */}
        <section>
          <label className="mb-1 flex items-baseline justify-between text-sm font-medium">
            <span>State — describe the situation</span>
            <span className={`text-xs tabular-nums ${state.length > LIMITS.stateMax ? "text-red-600" : "text-zinc-400"}`}>
              {state.length}/{LIMITS.stateMax}
            </span>
          </label>
          <textarea
            value={state}
            onChange={(e) => setState(e.target.value.slice(0, LIMITS.stateMax))}
            rows={4}
            placeholder="e.g. A marketplace listing for a used Peloton bike, $500, seller says 'like new'…"
            className={`${inputCls} rounded-xl p-3`}
          />
        </section>

        {/* Questions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Questions ({questions.length}/{LIMITS.questionsMax})</h2>
            <button
              type="button"
              disabled={questions.length >= LIMITS.questionsMax}
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("noul")])}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:border-red-400 disabled:opacity-40"
            >
              + Add question
            </button>
          </div>

          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex overflow-hidden rounded-lg border border-zinc-300 text-xs font-semibold">
                  {QUESTION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateQuestion(i, { ...emptyQuestion(t), instructions: q.instructions } as DraftQuestion)}
                      className={`px-3 py-2 uppercase transition-colors ${
                        q.type === t ? "bg-red-600 text-white" : "bg-white text-zinc-500 hover:bg-zinc-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                    className="px-2 py-1 text-xs text-zinc-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="mb-1 flex items-baseline justify-between text-xs text-zinc-500">
                <span>Instructions</span>
                <span className="tabular-nums">
                  {q.instructions.length}/{LIMITS.instructionsMax}
                </span>
              </label>
              <textarea
                value={q.instructions}
                onChange={(e) => updateQuestion(i, { ...q, instructions: e.target.value.slice(0, LIMITS.instructionsMax) } as DraftQuestion)}
                rows={2}
                placeholder={
                  q.type === "noul"
                    ? "A statement to judge true/false, e.g. 'The listing asks to pay outside the marketplace.'"
                    : q.type === "choice"
                      ? "e.g. Which category best fits this listing?"
                      : "e.g. How good is the described condition?"
                }
                className={inputCls}
              />

              {/* Criteria editor per type */}
              {q.type === "noul" && (
                <div className="mt-3 space-y-2 text-xs text-zinc-500">
                  <p>Optional descriptions (what true / false mean here):</p>
                  <input
                    value={q.criteria.true ?? ""}
                    onChange={(e) => updateQuestion(i, { ...q, criteria: { ...q.criteria, true: e.target.value } })}
                    placeholder="true means…"
                    className={inputCls}
                  />
                  <input
                    value={q.criteria.false ?? ""}
                    onChange={(e) => updateQuestion(i, { ...q, criteria: { ...q.criteria, false: e.target.value } })}
                    placeholder="false means…"
                    className={inputCls}
                  />
                </div>
              )}

              {q.type === "choice" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-zinc-500">Options ({q.criteria.length}, min {LIMITS.choiceOptionsMin}):</p>
                  {q.criteria.map((opt, j) => (
                    <div key={j} className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                      <div className="flex gap-2">
                        <input
                          value={opt.label}
                          onChange={(e) =>
                            updateQuestion(i, {
                              ...q,
                              criteria: q.criteria.map((o, k) => (k === j ? { ...o, label: e.target.value } : o)),
                            })
                          }
                          placeholder={`Option ${j + 1} label`}
                          className={inputCls}
                        />
                        {q.criteria.length > LIMITS.choiceOptionsMin && (
                          <button
                            type="button"
                            onClick={() => updateQuestion(i, { ...q, criteria: q.criteria.filter((_, k) => k !== j) })}
                            className="px-2 text-zinc-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <input
                        value={opt.description ?? ""}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...q,
                            criteria: q.criteria.map((o, k) => (k === j ? { ...o, description: e.target.value } : o)),
                          })
                        }
                        placeholder="Description (optional)"
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateQuestion(i, { ...q, criteria: [...q.criteria, { label: "" }] })}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:border-red-400"
                  >
                    + Add option
                  </button>
                </div>
              )}

              {q.type === "score" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-zinc-500">
                    Levels, lowest first ({q.criteria.length}/{LIMITS.scoreLevelsMax}, min {LIMITS.scoreLevelsMin}):
                  </p>
                  {q.criteria.map((level, j) => (
                    <div key={j} className="flex gap-2">
                      <span className="self-center font-mono text-xs text-zinc-400">{j}</span>
                      <input
                        value={level}
                        onChange={(e) =>
                          updateQuestion(i, { ...q, criteria: q.criteria.map((l, k) => (k === j ? e.target.value : l)) })
                        }
                        placeholder={`Level ${j} description`}
                        className={inputCls}
                      />
                      {q.criteria.length > LIMITS.scoreLevelsMin && (
                        <button
                          type="button"
                          onClick={() => updateQuestion(i, { ...q, criteria: q.criteria.filter((_, k) => k !== j) })}
                          className="px-2 text-zinc-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={q.criteria.length >= LIMITS.scoreLevelsMax}
                    onClick={() => updateQuestion(i, { ...q, criteria: [...q.criteria, ""] })}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:border-red-400 disabled:opacity-40"
                  >
                    + Add level
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Honeypot — invisible to humans, bots fill it */}
        <input
          ref={honeypotRef}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        <button
          type="button"
          onClick={decide}
          disabled={loading || !state.trim()}
          className="w-full rounded-xl bg-red-600 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-40"
        >
          {loading ? "Deciding…" : "Decide"}
        </button>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      {/* Right column: output */}
      <div ref={resultsRef} className="lg:sticky lg:top-6 lg:self-start">
        {result ? (
          <ResultPanel model={result.model} answers={result.answers} usage={result.usage} questions={questions} />
        ) : (
          <div className="hidden rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 lg:block">
            {loading ? "Asking Jev…" : "Decisions will appear here."}
          </div>
        )}
        {loading && (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 lg:hidden">
            Asking Jev…
          </div>
        )}
      </div>
    </div>
  );
}
