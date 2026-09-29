"use client";

import { useRef, useState } from "react";
import { RATING_LIMITS } from "@/lib/rating";
import { SectionLabel } from "@/components/primitives";

const SCALE = [1, 2, 3, 4, 5] as const;

const SCALE_WORDS: Record<number, string> = {
  1: "not useful",
  2: "barely useful",
  3: "somewhat useful",
  4: "useful",
  5: "decisive",
};

type Phase = "idle" | "saving" | "done" | "error";

/**
 * One rating per response, 1–5, with an optional free-text follow-up that only
 * appears once a score is chosen — asking for a comment first is the fastest
 * way to get neither.
 */
export default function RatingWidget({
  receipt,
  decidedAt,
  onRated,
}: {
  receipt: string;
  /** Timestamp of the decision render, for the time-to-rate signal. */
  decidedAt: number;
  onRated?: (score: number) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  async function send(nextScore: number, nextComment?: string) {
    setError(null);
    if (nextComment === undefined) setPhase("saving");
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt,
          score: nextScore,
          ...(nextComment ? { comment: nextComment } : {}),
          meta: { timeToRateMs: Date.now() - decidedAt },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setPhase("done");
      onRated?.(nextScore);
      if (nextComment) setCommentOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the rating");
      setPhase(nextComment === undefined ? "idle" : "error");
    }
  }

  async function submitComment() {
    if (score === null || !comment.trim()) return;
    await send(score, comment);
  }

  return (
    <section className="rise border-t-2 border-ink pt-5" style={{ "--i": 1 } as React.CSSProperties}>
      <SectionLabel meta="optional">Rate this response</SectionLabel>

      {phase === "done" && !commentOpen && score !== null ? (
        <div className="mt-3">
          <p className="text-row leading-relaxed text-ink-soft">
            Recorded — {score}/5, {SCALE_WORDS[score]}.{" "}
            <button
              type="button"
              onClick={() => setCommentOpen(true)}
              className="press text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-signal"
            >
              Add a note
            </button>{" "}
            or{" "}
            <button
              type="button"
              onClick={() => {
                setScore(null);
                setPhase("idle");
              }}
              className="press text-ink-soft underline decoration-rule-strong underline-offset-4 hover:text-signal"
            >
              change
            </button>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3.5 font-mono text-label font-medium tracking-[0.16em] text-ink-soft uppercase">
            How useful was it?
          </p>

          <div role="group" aria-label="Rate this response from 1 to 5" className="mt-2 flex gap-1.5">
            {SCALE.map((n) => {
              const active = score === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={phase === "saving"}
                  aria-pressed={active}
                  onClick={() => {
                    setScore(n);
                    void send(n);
                  }}
                  className={`press tnum flex h-11 w-11 items-center justify-center border font-mono text-[13px] ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-rule-strong bg-transparent text-ink-soft hover:border-ink hover:text-ink"
                  } disabled:opacity-50`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-note text-ink-faint">
            {score === null
              ? `1 = ${SCALE_WORDS[1]} · 5 = ${SCALE_WORDS[5]}`
              : `${score} — ${SCALE_WORDS[score]}`}
          </p>

          {score !== null && commentOpen && (
            <div className="rise mt-4">
              <label
                htmlFor="rating-comment"
                className="font-mono text-label font-medium tracking-[0.16em] text-ink uppercase"
              >
                What did it miss?
              </label>
              <textarea
                id="rating-comment"
                ref={commentRef}
                value={comment}
                maxLength={RATING_LIMITS.commentMax}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="e.g. It read the listing correctly but ignored that the price is below market."
                className="channel mt-2 w-full resize-none px-3 py-2.5 text-base leading-relaxed"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!comment.trim() || phase === "error"}
                  className="press border-2 border-ink bg-ink px-5 py-2.5 font-mono text-[12.5px] tracking-[0.14em] text-paper uppercase disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-ghost"
                >
                  {phase === "error" ? "Retry" : "Send note"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommentOpen(false);
                    setComment("");
                  }}
                  className="press font-mono text-[12.5px] tracking-[0.12em] text-ink-faint uppercase hover:text-ink"
                >
                  Skip
                </button>
                <span className="tnum ml-auto font-mono text-meta text-ink-faint">
                  {comment.length}/{RATING_LIMITS.commentMax}
                </span>
              </div>
            </div>
          )}

          {score !== null && !commentOpen && phase !== "saving" && (
            <button
              type="button"
              onClick={() => setCommentOpen(true)}
              className="press mt-3 self-start border-b border-dashed border-rule-strong pb-1 font-mono text-[12.5px] tracking-[0.12em] text-ink-soft uppercase hover:border-signal hover:text-signal"
            >
              + Add a note
            </button>
          )}

          {error && <p className="mt-3 text-note text-signal">{error}</p>}
        </>
      )}
    </section>
  );
}
