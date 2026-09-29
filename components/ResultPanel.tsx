import type { Answer, JevUsage } from "@/lib/jev";

function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function ConfidenceGauge({ value }: { value: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Confidence</span>
        <span className="font-mono">{pct(value)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-200">
        <div
          className="h-1.5 rounded-full bg-red-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">
        Confidence summarizes the whole distribution — it is not the probability of the winning option.
      </p>
    </div>
  );
}

function NoulBar({ answer }: { answer: Extract<Answer, { type: "noul" }> }) {
  const p = answer.noul;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Probability true</span>
        <span className="text-3xl font-bold tabular-nums text-zinc-900">{pct(p)}</span>
      </div>
      <div className="mt-2 h-3 w-full rounded-full bg-zinc-200">
        <div
          className="h-3 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">noul = {p.toFixed(4)}</p>
    </div>
  );
}

function ChoiceChart({ answer }: { answer: Extract<Answer, { type: "choice" }> }) {
  const entries = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <div className="mb-2 text-sm text-zinc-700">
        Decision: <span className="font-semibold text-red-600">{answer.choice}</span>
      </div>
      <div className="space-y-2">
        {entries.map(([label, p]) => {
          const isWinner = label === answer.choice;
          return (
            <div key={label}>
              <div className="flex justify-between text-xs">
                <span className={isWinner ? "font-semibold text-red-600" : "text-zinc-600"}>{label}</span>
                <span className="font-mono text-zinc-500">{pct(p)}</span>
              </div>
              <div className="mt-0.5 h-2 w-full rounded-full bg-zinc-200">
                <div
                  className={`h-2 rounded-full transition-all ${isWinner ? "bg-red-500" : "bg-zinc-400"}`}
                  style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <ConfidenceGauge value={answer.confidence} />
    </div>
  );
}

function ScoreScale({ answer }: { answer: Extract<Answer, { type: "score" }> }) {
  const levels = Object.entries(answer.legend).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Expected score</span>
        <span className="text-3xl font-bold tabular-nums text-zinc-900">{answer.score.toFixed(2)}</span>
      </div>
      <div className="mt-3 space-y-2">
        {levels.map(([idx, desc]) => {
          const p = answer.probabilities[idx] ?? 0;
          return (
            <div key={idx}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-zinc-600">
                  <span className="font-mono text-zinc-400">{idx}.</span> {desc}
                </span>
                <span className="shrink-0 font-mono text-zinc-500">{pct(p)}</span>
              </div>
              <div className="mt-0.5 h-2 w-full rounded-full bg-zinc-200">
                <div
                  className="h-2 rounded-full bg-violet-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <ConfidenceGauge value={answer.confidence} />
    </div>
  );
}

export default function ResultPanel({
  model,
  answers,
  usage,
  questions,
}: {
  model: string;
  answers: Record<string, Answer>;
  usage?: JevUsage;
  questions: { instructions: string }[];
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Decisions</h2>
      {Object.entries(answers).map(([id, answer], i) => (
        <div key={id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-zinc-800">
            Q{i + 1}. {questions[i]?.instructions ?? id}
          </p>
          {answer.type === "noul" && <NoulBar answer={answer} />}
          {answer.type === "choice" && <ChoiceChart answer={answer} />}
          {answer.type === "score" && <ScoreScale answer={answer} />}
        </div>
      ))}
      <p className="text-center text-[10px] text-zinc-400">
        {model}
        {usage ? ` · ${usage.input_tokens} in / ${usage.output_tokens} out` : ""}
        {usage?.cost != null ? ` · $${usage.cost.toFixed(6)}` : ""}
      </p>
    </section>
  );
}
