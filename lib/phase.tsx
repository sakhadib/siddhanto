"use client";

import { useEffect, useRef, useState } from "react";

/* ==========================================================================
   What the page says while it waits.

   A model call here takes several seconds of silence. A spinner is an honest
   "something is happening" and a terrible description of it: the author has
   just handed over a messy situation and is being asked to trust a number, so
   the wait should say what is being worked out rather than merely that time
   is passing.

   Steps are shuffled on every wait. A fixed order reads as a progress bar and
   invites the question "how far through is this?" — which nobody can answer,
   because the steps are stages of thought, not fractions of a job.
   ========================================================================== */

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Drafting a form from speech: deciding what to ask, and how to ask it. */
export const DRAFT_STAGES = [
  "reading the situation",
  "finding what is actually being asked",
  "separating the stakes from the details",
  "choosing what to measure",
  "making the options",
  "settling on the scale",
  "asking the right questions",
  "designing the set",
  "ordering them by what matters",
  "checking each one is answerable",
  "tightening the wording",
  "setting the form",
] as const;

/** Calling JEV: one pass over the state, then a distribution per question. */
export const DECIDE_STAGES = [
  "reading the state",
  "locating the uncertainty",
  "weighing the first question",
  "distributing across the options",
  "running the scale",
  "comparing against the alternatives",
  "reading the whole set together",
  "calibrating",
  "checking the spread",
  "settling the numbers",
  "checking the confidence",
  "returning the readout",
] as const;

/** Writing the Reading: prose grounded in the numbers just returned. */
export const READING_STAGES = [
  "following the numbers",
  "seeing which way they lean",
  "describing the shape",
  "checking against the state",
  "noticing what the figures miss",
  "writing it out",
  "keeping it to one reading",
  "setting it down",
] as const;

export interface Stage {
  /** Every step in the order this particular wait revealed them. */
  done: string[];
  /** The step being worked on now. */
  current: string;
  /** True once the last step has been reached. */
  finished: boolean;
}

/**
 * Reveal `stages` one at a time while `active`. The last step stays put for
 * however long the call actually takes, so the display always ends on the
 * final stage instead of cycling forever.
 */
export function useStages(
  stages: readonly string[],
  active: boolean,
  intervalMs = 1500
): Stage {
  // `stages` comes from a module constant, so it is safe to leave out of the
  // dependency lists below.
  const [order, setOrder] = useState<string[]>(() => shuffle(stages));
  const [revealed, setRevealed] = useState<string[]>([]);
  const wasActive = useRef(false);

  useEffect(() => {
    // Shuffle when a wait begins, not when it ends: the author is looking at
    // the list while it builds, so the order has to be fixed for its duration.
    if (active && !wasActive.current) setOrder(shuffle(stages));
    if (!active && wasActive.current) setRevealed([]);
    wasActive.current = active;
  }, [active, stages]);

  useEffect(() => {
    if (!active) return;
    if (revealed.length === 0) setRevealed([order[0]]);
  }, [active, revealed.length, order]);

  useEffect(() => {
    if (!active) return;
    if (revealed.length >= order.length) return;
    const t = setTimeout(() => {
      setRevealed((r) => (r.length < order.length ? [...r, order[r.length]] : r));
    }, intervalMs);
    return () => clearTimeout(t);
  }, [active, revealed.length, order, intervalMs]);

  useEffect(() => {
    if (!active) return;
    if (revealed.length >= order.length) return;
    const t = setTimeout(() => {
      setRevealed((r) => (r.length < order.length ? [...r, order[r.length]] : r));
    }, intervalMs);
    return () => clearTimeout(t);
  }, [active, revealed.length, order, intervalMs]);

  return {
    done: revealed.length ? revealed : [order[0]],
    current: revealed[revealed.length - 1] ?? order[0],
    finished: revealed.length >= order.length,
  };
}

/**
 * The visible list. Earlier steps recede rather than disappear: the author can
 * see the work they waited through, which is the whole point of showing it.
 */
export function StageList({
  stage,
  className = "",
}: {
  stage: Stage;
  className?: string;
}) {
  return (
    <ul className={`flex flex-col gap-1.5 ${className}`} aria-live="polite">
      {stage.done.map((s, i) => {
        const isLast = i === stage.done.length - 1;
        return (
          <li
            key={`${s}-${i}`}
            className={
              isLast
                ? "font-mono text-meta tracking-[0.1em] text-signal uppercase"
                : "font-mono text-meta tracking-[0.1em] text-ink-ghost uppercase"
            }
          >
            {isLast ? <span aria-hidden className="mr-2">▸</span> : null}
            {s}
          </li>
        );
      })}
    </ul>
  );
}
