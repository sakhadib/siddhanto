"use client";

import { LIMITS } from "@/lib/validate";
import { Field, SectionLabel } from "@/components/primitives";

export type DraftQuestion =
  | { type: "noul"; instructions: string; criteria: { true?: string; false?: string } }
  | { type: "choice"; instructions: string; criteria: { label: string; description?: string }[] }
  | { type: "score"; instructions: string; criteria: string[] };

const QUESTION_TYPES = ["noul", "score", "choice"] as const;

const TYPE_BLURB: Record<DraftQuestion["type"], string> = {
  noul: "One statement. The model returns a calibrated probability that it is true.",
  score: "An ordered scale. The model returns the expected value and the mass at each level.",
  choice: "A closed set of options. The model returns a probability for each and picks one.",
};

export function emptyQuestion(type: DraftQuestion["type"]): DraftQuestion {
  if (type === "choice")
    return { type, instructions: "", criteria: [{ label: "" }, { label: "" }] };
  if (type === "score") return { type, instructions: "", criteria: ["", ""] };
  return { type, instructions: "", criteria: {} };
}

/** A monospace index gutter cell — the leftmost column of every ledger row. */
function Gutter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-7 shrink-0 pr-2 text-right font-mono text-[10px] leading-5 text-ink-ghost tnum ${className}`}>
      {children}
    </div>
  );
}

export default function QuestionRow({
  index,
  total,
  question,
  onChange,
  onRemove,
}: {
  index: number;
  total: number;
  question: DraftQuestion;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
}) {
  const { type } = question;

  function setInstructions(v: string) {
    onChange({ ...question, instructions: v } as DraftQuestion);
  }

  return (
    <section className="rise" style={{ "--i": index + 1 } as React.CSSProperties}>
      <SectionLabel
        meta={
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="press ml-2 text-ink-ghost hover:text-signal disabled:pointer-events-none disabled:opacity-30"
          >
            Remove
          </button>
        }
      >
        Query {String(index + 1).padStart(2, "0")}
      </SectionLabel>

      <div className="mt-3 flex gap-3">
        <div
          aria-hidden
          className="w-7 shrink-0 translate-y-1 border-r border-rule pr-2 text-right font-mono text-[13px] leading-5 text-ink-faint tnum"
        >
          q{index}
        </div>

        <div className="min-w-0 flex-1">
          {/* Type selector — text tabs with an underline, not a filled pill. */}
          <div role="tablist" aria-label={`Question ${index + 1} type`} className="flex gap-5">
            {QUESTION_TYPES.map((t) => {
              const active = type === t;
              return (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() =>
                    onChange({
                      ...emptyQuestion(t),
                      instructions: question.instructions,
                    } as DraftQuestion)
                  }
                  className={`press -mb-px border-b-2 pb-1.5 font-mono text-[11px] tracking-[0.16em] uppercase ${
                    active
                      ? "border-signal text-ink"
                      : "border-transparent text-ink-ghost hover:text-ink-soft"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{TYPE_BLURB[type]}</p>

          <div className="mt-3">
            <Field
              label="Instructions"
              meta={`${question.instructions.length}/${LIMITS.instructionsMax}`}
              textarea
              rows={2}
              value={question.instructions}
              onChange={(e) => setInstructions(e.target.value.slice(0, LIMITS.instructionsMax))}
              placeholder={
                type === "noul"
                  ? "A statement to judge, e.g. “The seller asks to be paid outside the marketplace.”"
                  : type === "choice"
                    ? "e.g. Which category best describes this item?"
                    : "e.g. How good is the described condition?"
              }
            />
          </div>

          {/* Criteria ledger — one row per axis of the question. */}
          {type === "noul" && (
            <div className="mt-4 flex flex-col gap-2.5">
              {(["true", "false"] as const).map((side) => (
                <div key={side} className="flex items-center gap-3">
                  <Gutter>{side === "true" ? "T" : "F"}</Gutter>
                  <input
                    aria-label={`What true means`}
                    value={question.criteria[side] ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...question,
                        criteria: { ...question.criteria, [side]: e.target.value.slice(0, 300) },
                      })
                    }
                    placeholder={side === "true" ? "true means…" : "false means…"}
                    className="w-full border-b border-rule bg-transparent pb-1.5 text-[13px] text-ink placeholder:text-ink-ghost/70 focus:border-signal focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {type === "choice" && (
            <div className="mt-4">
              <SectionLabel
                meta={`${question.criteria.length} options · min ${LIMITS.choiceOptionsMin}`}
              >
                Options
              </SectionLabel>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {question.criteria.map((opt, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Gutter>{String(j + 1).padStart(2, "0")}</Gutter>
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Option ${j + 1} label`}
                        value={opt.label}
                        onChange={(e) =>
                          onChange({
                            ...question,
                            criteria: question.criteria.map((o, k) =>
                              k === j ? { ...o, label: e.target.value.slice(0, 100) } : o,
                            ),
                          })
                        }
                        placeholder="Option label"
                        className="w-full border-b border-rule-strong bg-transparent pb-1 text-[13px] text-ink placeholder:text-ink-ghost/70 focus:border-signal focus:outline-none"
                      />
                      <input
                        aria-label={`Option ${j + 1} description`}
                        value={opt.description ?? ""}
                        onChange={(e) =>
                          onChange({
                            ...question,
                            criteria: question.criteria.map((o, k) =>
                              k === j ? { ...o, description: e.target.value.slice(0, 500) } : o,
                            ),
                          })
                        }
                        placeholder="Description, optional"
                        className="mt-1.5 w-full border-b border-rule bg-transparent pb-1 text-[11px] text-ink-soft placeholder:text-ink-ghost/70 focus:border-signal focus:outline-none"
                      />
                    </div>
                    {question.criteria.length > LIMITS.choiceOptionsMin && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...question,
                            criteria: question.criteria.filter((_, k) => k !== j),
                          })
                        }
                        aria-label={`Remove option ${j + 1}`}
                        className="press shrink-0 px-1 font-mono text-sm text-ink-ghost hover:text-signal"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={question.criteria.length >= LIMITS.choiceOptionsMax}
                onClick={() =>
                  onChange({ ...question, criteria: [...question.criteria, { label: "" }] })
                }
                className="press mt-3 border-b border-dashed border-rule-strong pb-0.5 font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase hover:border-signal hover:text-signal disabled:pointer-events-none disabled:opacity-40"
              >
                + Add option
              </button>
            </div>
          )}

          {type === "score" && (
            <div className="mt-4">
              <SectionLabel
                meta={`${question.criteria.length} levels · max ${LIMITS.scoreLevelsMax}`}
              >
                Scale, lowest first
              </SectionLabel>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {question.criteria.map((level, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Gutter>{j}</Gutter>
                    <input
                      aria-label={`Level ${j} description`}
                      value={level}
                      onChange={(e) =>
                        onChange({
                          ...question,
                          criteria: question.criteria.map((l, k) =>
                            k === j ? e.target.value.slice(0, 300) : l,
                          ),
                        })
                      }
                      placeholder={`Level ${j} — e.g. ${["unusable", "worn", "serviceable", "near new"][j] ?? "description"}`}
                      className="w-full border-b border-rule-strong bg-transparent pb-1 text-[13px] text-ink placeholder:text-ink-ghost/70 focus:border-signal focus:outline-none"
                    />
                    {question.criteria.length > LIMITS.scoreLevelsMin && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...question,
                            criteria: question.criteria.filter((_, k) => k !== j),
                          })
                        }
                        aria-label={`Remove level ${j}`}
                        className="press shrink-0 px-1 font-mono text-sm text-ink-ghost hover:text-signal"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={question.criteria.length >= LIMITS.scoreLevelsMax}
                onClick={() => onChange({ ...question, criteria: [...question.criteria, ""] })}
                className="press mt-3 border-b border-dashed border-rule-strong pb-0.5 font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase hover:border-signal hover:text-signal disabled:pointer-events-none disabled:opacity-40"
              >
                + Add level
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
