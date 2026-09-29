import type { Answer, JevUsage } from "@/lib/jev";
import DecisionChart from "@/components/DecisionChart";
import { Axis, MeasureBar, Readout, SectionLabel, pct } from "@/components/primitives";
import { StageList, type Stage } from "@/lib/phase";

/* ==========================================================================
   Readout surface. Each answer pairs a Plotly chart with the exact figures in
   text — the chart carries hover and shape, the text stays selectable,
   screen-readable and legible without a pointer.
   ========================================================================== */

function Confidence({ value, i }: { value: number; i: number }) {
  return (
    <div className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-label font-medium tracking-[0.16em] text-ink-soft uppercase">
          Confidence
        </span>
        <span className="tnum font-mono text-[15px] text-ink-soft">{pct(value)}</span>
      </div>
      <div className="mt-2">
        <MeasureBar value={value} i={i} showAxis={false} />
      </div>
      <p className="mt-2.5 max-w-[52ch] text-note text-ink-faint">
        Confidence summarises the whole distribution. It is not the probability of the
        winning option.
      </p>
    </div>
  );
}

function NoulView({ answer, i }: { answer: Extract<Answer, { type: "noul" }>; i: number }) {
  return (
    <>
      <Readout label="Probability true" value={pct(answer.noul)} i={i} />
      <div className="mt-4">
        <DecisionChart answer={answer} />
        <p className="tnum mt-2.5 font-mono text-meta text-ink-faint">
          noul = {answer.noul.toFixed(4)} · no confidence is returned for noul
        </p>
      </div>
    </>
  );
}

function ChoiceView({
  answer,
  i,
  labelMap,
}: {
  answer: Extract<Answer, { type: "choice" }>;
  i: number;
  labelMap: Record<string, string>;
}) {
  // JEV keyed its answer on the English labels it was given. A Bangla reader
  // only knows the words they typed, so the keys are mapped back for display.
  // The stored record keeps the English keys untouched.
  const name = (k: string) => labelMap[k] ?? k;
  const raw = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);
  const entries = raw.map(([k, p]) => [name(k), p] as [string, number]);
  const winner = name(answer.choice);
  // Looked up under the original key, not the mapped label.
  const winnerP = answer.probabilities[answer.choice] ?? 0;
  return (
    <>
      <SectionLabel meta={`${entries.length} options`}>Distribution</SectionLabel>
      {/* Every figure is printed on its own bar, so the table that used to sit
          underneath was saying the same numbers twice. The chart carries the
          full breakdown in its aria-label, which is where a screen reader and
          a copy-paste of the SVG both find them now. */}
      <div className="mt-3">
        <DecisionChart answer={answer} labels={labelMap} />
      </div>
      <p className="tnum mt-1.5 font-mono text-meta text-ink-faint">
        selected: {winner} · {pct(winnerP, 1)}
      </p>
      <Confidence value={answer.confidence} i={i} />
    </>
  );
}

function ScoreView({ answer, i }: { answer: Extract<Answer, { type: "score" }>; i: number }) {
  const levels = Object.entries(answer.legend).sort((a, b) => Number(a[0]) - Number(b[0]));
  const max = Math.max(1, levels.length - 1);
  return (
    <>
      <Readout label="Expected score" value={answer.score.toFixed(3)} i={i} />
      <div className="mt-4">
        <SectionLabel meta={`scale 0–${max}`}>Mass by level</SectionLabel>
        <div className="mt-1">
          <DecisionChart answer={answer} />
        </div>
        {/* The scale's own words, kept as text: the chart's ticks carry the
            level numbers, not what the levels mean, so this is not a duplicate
            of the bars — it is the legend. */}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {levels.map(([idx, desc], k) => (
            <li
              key={idx}
              className={`tnum font-mono text-[12px] ${
                k === Math.round(answer.score) ? "text-signal" : "text-ink-faint"
              }`}
            >
              {idx} {desc}
            </li>
          ))}
        </ul>
      </div>
      <Confidence value={answer.confidence} i={i} />
    </>
  );
}

/* ------------------------------------------------------------------ states */

function EmptyState() {
  return (
    <div className="rise flex flex-col justify-center py-10">
      <p className="font-mono text-label font-medium tracking-[0.16em] text-ink-soft uppercase">
        Awaiting input
      </p>
      <p className="mt-3 max-w-[40ch] text-lead leading-relaxed text-ink-soft">
        Fill the form on the left, or describe the situation above and let it be built for
        you. Either way the model answers with a probability, a distribution, or an
        expected value — each read against the same 0–100 scale.
      </p>
      <div className="mt-6 opacity-40" aria-hidden>
        <MeasureBar value={0.0} showAxis={false} />
        <Axis />
      </div>
    </div>
  );
}

function LoadingState({ stage }: { stage: Stage }) {
  return (
    <div className="flex flex-col justify-center py-10" role="status" aria-live="polite">
      <p className="font-mono text-label font-medium tracking-[0.16em] text-signal uppercase">Deciding…</p>
      <div className="relative mt-4 h-10 w-32 overflow-hidden border-y border-rule bg-paper-sunk sweep" aria-hidden>
        <span className="absolute inset-x-0 bottom-0 h-px bg-rule-strong" />
      </div>
      <div className="mt-6 flex flex-col gap-3" aria-hidden>
        {[0, 1].map((k) => (
          <div key={k}>
            <div className="h-2.5 border-y border-rule bg-paper-sunk" />
            <Axis labels={false} />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <StageList stage={stage} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- panel */

export default function ResultPanel({
  model,
  answers,
  usage,
  questions,
  labelMap = {},
}: {
  model: string;
  answers: Record<string, Answer>;
  usage?: JevUsage;
  questions: { instructions: string }[];
  labelMap?: Record<string, string>;
}) {
  const list = Object.entries(answers);

  return (
    <section>
      <SectionLabel meta={`${list.length} ${list.length === 1 ? "answer" : "answers"}`}>
        Readout
      </SectionLabel>

      <div className="mt-5 flex flex-col">
        {list.map(([id, answer], i) => (
          <article key={id} className="py-8 first:pt-0">
            <div className="mb-4">
              <p className="font-mono text-label font-medium tracking-[0.16em] text-ink-soft uppercase">
                Query {String(i + 1).padStart(2, "0")} · {answer.type}
              </p>
              <p className="mt-2 max-w-[52ch] text-lead leading-snug font-medium text-ink">
                {questions[i]?.instructions ?? id}
              </p>
            </div>

            {answer.type === "noul" && <NoulView answer={answer} i={i} />}
            {answer.type === "choice" && (
              <ChoiceView answer={answer} i={i} labelMap={labelMap} />
            )}
            {answer.type === "score" && <ScoreView answer={answer} i={i} />}
          </article>
        ))}
      </div>

      <p className="tnum mt-3 font-mono text-meta leading-relaxed text-ink-faint">
        {model}
        {usage ? ` · ${usage.input_tokens} in / ${usage.output_tokens} out` : ""}
        {usage?.cost != null ? ` · $${usage.cost.toFixed(6)}` : ""}
      </p>
    </section>
  );
}

export { EmptyState, LoadingState };
