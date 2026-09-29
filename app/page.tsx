"use client";

import { useEffect, useRef, useState } from "react";
import { LIMITS, type Question } from "@/lib/validate";
import type { Answer, JevUsage } from "@/lib/jev";
import ResultPanel, { EmptyState, LoadingState } from "@/components/ResultPanel";
import QuestionRow, { emptyQuestion, type DraftQuestion } from "@/components/QuestionRow";
import RatingWidget from "@/components/RatingWidget";
import AdviceSection from "@/components/AdviceSection";
import { Field, InkButton, Notice, SectionLabel } from "@/components/primitives";
import Drafter, { type DraftPayload } from "@/components/Drafter";
import { DECIDE_STAGES, StageList, useStages } from "@/lib/phase";
import { detectFromParts, type Lang } from "@/lib/lang";

interface ApiResult {
  model: string;
  answers: Record<string, Answer>;
  usage?: JevUsage;
  /** Opaque signed receipt from the server; present only when the decision was
   *  recorded and RATING_SECRET is configured. */
  receipt?: string;
  /** Present when the author wrote Bangla: the English text JEV actually read. */
  lang?: Lang;
  stateEn?: string;
  questionsEn?: Question[];
}

/** Four uppercase hex characters. A label, not an identifier — nothing is
 *  recorded under it; it only marks the current sitting for the author. */
const EMPTY_SESSION = "····";

function newSessionId(): string {
  const b = new Uint8Array(2);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
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
  // The English projection the server sent back, when the author wrote Bangla.
  // The Reading is generated from this, not from the Bangla the user typed.
  const [english, setEnglish] = useState<{ state: string; questions: Question[] } | null>(null);

  // A client-side handle for "start over". It remounts the input rail, which
  // is what actually clears the drafting transcript — the component owns that
  // state and nothing outside it can reach in.
  //
  // It must not be randomised during render: the server and the client would
  // each produce a different id, and the visible one is rendered as text in
  // the Input label, so the two trees would disagree and React would throw the
  // server HTML away. It is a placeholder until the effect below runs.
  useEffect(() => setSession(newSessionId()), []);
  const [session, setSession] = useState(EMPTY_SESSION);
  const decideStage = useStages(DECIDE_STAGES, loading);

  /** A drafted form is a proposal. It lands in the same state a hand-typed one
   *  would, which is the point: the author reviews it exactly the same way. */
  function applyDraft(d: DraftPayload) {
    setState(d.state);
    setQuestions(d.questions as DraftQuestion[]);
    setResult(null);
    setError(null);
    setEnglish(null);
    decidedAt.current = Date.now();
  }

  /** Clear every field and open a new session. The drafter's transcript is
   *  cleared by the remount, which is why this bumps the key on the rail. */
  function refresh() {
    setState("");
    setQuestions([emptyQuestion("noul")]);
    setResult(null);
    setError(null);
    setEnglish(null);
    setSession(newSessionId());
    decidedAt.current = Date.now();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      if (data.lang === "bn" && data.stateEn && data.questionsEn) {
        setEnglish({ state: data.stateEn, questions: data.questionsEn });
      } else {
        setEnglish(null);
      }
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

  /** Live detection, for the indicator under the state field. The server
   *  re-detects and is authoritative; this is only to tell the writer what
   *  will happen. */
  const writtenLang: Lang = detectFromParts([
    state,
    ...questions.map((q) =>
      q.type === "choice"
        ? [q.instructions, ...q.criteria.map((c) => c.label)].join(" ")
        : q.type === "score"
          ? [q.instructions, ...q.criteria].join(" ")
          : [q.instructions, q.criteria.true ?? "", q.criteria.false ?? ""].join(" "),
    ),
  ]);

  /** Map the English option labels JEV keyed its answer on back to the labels
   *  the reader typed. Translation preserves option order, so this is a
   *  positional mapping rather than a guess. */
  const labelMap: Record<string, string> = {};
  if (english) {
    english.questions.forEach((q, i) => {
      if (q.type !== "choice") return;
      const orig = questions[i];
      if (orig?.type !== "choice") return;
      q.criteria.forEach((c, j) => {
        const o = orig.criteria[j];
        if (o?.label) labelMap[c.label] = o.label;
      });
    });
  }

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
            to score, or a closed set of options. Or describe the situation in ordinary words on
            the right and have the form built for you. The model returns calibrated numbers, and
            the confidence figure describes the distribution rather than the winner.
          </p>
        </div>
      </section>

      <div className="grid gap-12 border-t-2 border-ink pt-8 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
        {/* ------------------------------------------------ input rail */}
        <div key={session} className="flex flex-col gap-12">
          <SectionLabel meta={session}>Input</SectionLabel>

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
              {writtenLang === "bn" && (
                <p className="mt-3 flex items-baseline gap-2 border-l-2 border-signal pl-3 text-note text-ink-soft">
                  <span className="font-mono text-[11px] tracking-[0.16em] text-signal uppercase">
                    বাংলা
                  </span>
                  <span>
                    Detected. Your question is translated into English for the model, and
                    the reading comes back in Bangla.
                  </span>
                </p>
              )}
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
              pendingLabel={decideStage.current}
            >
              Decide
            </InkButton>
            <p className="max-w-[52ch] text-note text-ink-faint">
              {state.trim()
                ? "Each submission is recorded — see the privacy policy."
                : "Describe the situation above to enable the read."}
            </p>
            {writtenLang === "bn" && !loading && (
              <p className="max-w-[52ch] text-note text-ink-faint">
                Bangla is supported, but it costs one extra pass: the question is translated
                into English before the model sees it, so the numbers take a little longer.
              </p>
            )}

            {loading && (
              <div className="mt-1">
                <StageList stage={decideStage} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="press w-full border-2 border-rule-strong px-6 py-4 font-mono text-[15px] tracking-[0.18em] text-ink-soft uppercase transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              New question
            </button>
            <p className="max-w-[52ch] text-note text-ink-faint">
              Clears the form and starts a new session. Nothing recorded so far is
              affected.
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
                labelMap={labelMap}
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
            <LoadingState stage={decideStage} />
          ) : (
            <>
              <Drafter
                current={{
                  state,
                  questions: questions.filter(
                    (q) => q.instructions.trim() || !q.criteria
                  ) as Question[],
                }}
                onDraft={applyDraft}
              />
              <div className="mt-10">
                <EmptyState />
              </div>
            </>
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
          state={english?.state ?? state}
          questions={(english?.questions ?? (questions as Question[]))}
          answers={result.answers}
          lang={result.lang ?? "en"}
        />
      )}
    </>
  );
}
