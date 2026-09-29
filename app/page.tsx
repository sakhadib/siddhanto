"use client";

import { useRef, useState } from "react";
import { LIMITS, type Question } from "@/lib/validate";
import type { Answer, JevUsage } from "@/lib/jev";
import ResultPanel, { EmptyState, LoadingState } from "@/components/ResultPanel";
import QuestionRow, { emptyQuestion, type DraftQuestion } from "@/components/QuestionRow";
import RatingWidget from "@/components/RatingWidget";
import AdviceSection from "@/components/AdviceSection";
import { Field, InkButton, Notice, SectionLabel } from "@/components/primitives";

interface ApiResult {
  model: string;
  answers: Record<string, Answer>;
  usage?: JevUsage;
  /** Opaque signed receipt from the server; present only when the decision was
   *  recorded and RATING_SECRET is configured. */
  receipt?: string;
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
  // When the readout last rendered, so the widget can report time-to-rate.
  const decidedAt = useRef(Date.now());

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
        const issues = data.issues
          ?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`)
          .join(" · ");
        throw new Error(issues || data.error || `Request failed (${res.status})`);
      }
      setResult(data);
      decidedAt.current = Date.now();
      // On mobile the readout is below the fold — take them to it.
      if (window.innerWidth < 1024) {
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = state.trim().length > 0 && !loading;

  return (
    <>
      {/* Intro — asymmetric, left-aligned, no centred hero. */}
      <section className="rise grid items-end gap-6 pt-10 pb-12 lg:grid-cols-[1.45fr_1fr] lg:gap-12">
        <div>
          <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-signal uppercase">
            Not advice — calibration
          </p>
          <h1 className="mt-4 max-w-[20ch] text-[clamp(2.2rem,5.4vw,3.6rem)] leading-[1.03] font-semibold tracking-tighter text-ink">
            Ask a precise question about a messy situation. Get a probability, not an opinion.
          </h1>
        </div>
        <div className="lg:pb-2">
          <p className="max-w-[48ch] text-[15.5px] leading-relaxed text-ink-soft">
            State what is going on, then pose up to ten queries — a statement to judge, a scale
            to score, or a closed set of options. The model returns calibrated numbers, and the
            confidence figure describes the distribution rather than the winner.
          </p>
        </div>
      </section>

      <div className="grid gap-12 border-t-2 border-ink pt-8 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        {/* ------------------------------------------------ input rail */}
        <div className="flex flex-col gap-12">
          <SectionLabel>Input</SectionLabel>

          <section className="rise" style={{ "--i": 1 } as React.CSSProperties}>
            <SectionLabel meta={`${state.length}/${LIMITS.stateMax}`}>The situation</SectionLabel>
            <div className="mt-4">
              <Field
                label="State"
                textarea
                rows={5}
                value={state}
                onChange={(e) => setState(e.target.value.slice(0, LIMITS.stateMax))}
                placeholder="A marketplace listing for a used Peloton bike, $500, the seller says “like new” and wants payment by bank transfer…"
                hint="Everything the model has to reason from. Be specific — vagueness here becomes vagueness in the numbers."
              />
            </div>
          </section>

          <section className="flex flex-col">
            <SectionLabel meta={`${questions.length}/${LIMITS.questionsMax}`}>
              Queries
            </SectionLabel>

            <div className="mt-6 flex flex-col gap-11">
              {questions.map((q, i) => (
                <div key={i} className="pb-10 last:pb-0">
                  <QuestionRow
                    index={i}
                    total={questions.length}
                    question={q}
                    onChange={(next) => updateQuestion(i, next)}
                    onRemove={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={questions.length >= LIMITS.questionsMax}
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("noul")])}
              className="press mt-6 self-start border-b border-dashed border-rule-strong pb-1 font-mono text-[12.5px] tracking-[0.12em] text-ink-soft uppercase hover:border-signal hover:text-signal disabled:pointer-events-none disabled:opacity-40"
            >
              + Add query
            </button>
          </section>

          {/* Honeypot — off-screen, invisible to humans, filled by bots. */}
          <input
            ref={honeypotRef}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          <div className="flex flex-col gap-3">
            <InkButton
              onClick={decide}
              disabled={!canSubmit}
              pending={loading}
              pendingLabel="Reading…"
            >
              {loading ? "Reading…" : "Decide"}
            </InkButton>
            <p className="max-w-[52ch] text-note text-ink-faint">
              {state.trim()
                ? "Each submission is recorded — see the privacy policy."
                : "Describe the situation above to enable the read."}
            </p>
          </div>

          {error && (
            <div className="rise">
              <Notice>
                <span className="font-mono text-label font-medium tracking-[0.16em] uppercase">Rejected</span>
                <p className="mt-1">{error}</p>
              </Notice>
            </div>
          )}
        </div>

        {/* ----------------------------------------------- readout rail */}
        <div ref={resultsRef} className="lg:sticky lg:top-8 lg:self-start">
          {result ? (
            <>
              <ResultPanel
                model={result.model}
                answers={result.answers}
                usage={result.usage}
                questions={questions}
              />
              {result.receipt && (
                <div className="mt-8">
                  <RatingWidget
                    key={result.receipt}
                    receipt={result.receipt}
                    decidedAt={decidedAt.current}
                  />
                </div>
              )}
            </>
          ) : loading ? (
            <LoadingState />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* The reading layer — full width, below both rails, so it lands as the
          conclusion of the page. It only mounts once a decision is in hand,
          and it streams on its own; the numbers above never wait for it. */}
      {result?.receipt && (
        <AdviceSection
          key={result.receipt}
          receipt={result.receipt}
          state={state}
          questions={questions as Question[]}
          answers={result.answers}
        />
      )}
    </>
  );
}
