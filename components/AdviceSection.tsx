"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Answer } from "@/lib/jev";
import type { Question } from "@/lib/validate";
import { splitAdviseStream } from "@/lib/advise-protocol";

type Phase = "streaming" | "done" | "error";

/* ==========================================================================
   The reading layer. Full width, below both columns, so it reads as the
   conclusion of the page rather than another panel competing with the
   numbers. The largest prose on the page, which is the point: everything
   above it is small monospace, this is the sentence a person actually reads.
   ========================================================================== */

const PROSE = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-0 mb-4 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-ink">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mt-0 mb-4 list-disc pl-5 space-y-1.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mt-0 mb-4 list-decimal pl-5 space-y-1.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-paper-sunk px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-signal"
      rel="noopener noreferrer nofollow"
      target="_blank"
    >
      {children}
    </a>
  ),
} as const;

export default function AdviceSection({
  receipt,
  state,
  questions,
  answers,
}: {
  receipt: string;
  state: string;
  questions: Question[];
  answers: Record<string, Answer>;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("streaming");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        const res = await fetch("/api/advise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({ receipt, state, questions, answers }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        if (!res.body) throw new Error("No stream returned");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Strip any sentinel as it arrives so a mid-stream failure never
          // flashes raw control characters into the prose.
          const { text: clean, error: err } = splitAdviseStream(buffer);
          setText(clean);
          if (err) {
            setError(err);
            setPhase("error");
            return;
          }
        }

        const final = splitAdviseStream(buffer);
        setText(final.text);
        if (final.error) {
          setError(final.error);
          setPhase("error");
        } else {
          setPhase("done");
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "The reading layer is unavailable.");
        setPhase("error");
      }
    })();

    return () => ac.abort();
    // Re-run only if the receipt changes, i.e. a new decision was recorded.
  }, [receipt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="mt-14 border-t-2 border-ink pt-6 sm:mt-16 sm:pt-8" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-label font-medium tracking-[0.16em] text-ink uppercase">
          Reading
        </p>
        <p className="font-mono text-meta text-ink-faint">
          {phase === "streaming" ? "composing…" : phase === "error" ? "unavailable" : "from the numbers above"}
        </p>
      </div>

      {phase === "streaming" && !text && (
        <div className="mt-5 flex flex-col gap-2.5" aria-hidden>
          <div className="sweep relative h-4 w-full max-w-[52ch] overflow-hidden bg-paper-sunk" />
          <div className="sweep relative h-4 w-3/5 overflow-hidden bg-paper-sunk" style={{ animationDelay: "120ms" }} />
        </div>
      )}

      {text && (
        <div className="mt-5 max-w-[62ch] text-[18px] leading-[1.62] text-ink sm:text-[19px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={PROSE}>
            {text}
          </ReactMarkdown>
          {phase === "streaming" && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1.05em] w-[3px] translate-y-[0.18em] bg-signal align-baseline"
            />
          )}
        </div>
      )}

      {phase === "error" && !text && (
        <p className="mt-5 max-w-[52ch] text-note text-ink-faint">
          The reading could not be composed. The numbers above are unaffected.
        </p>
      )}

      {error && text && (
        <p className="mt-3 text-note text-ink-faint">
          The reading stopped early. The numbers above are unaffected.
        </p>
      )}

      <p className="mt-6 max-w-[62ch] text-note text-ink-faint">
        This is an interpretation of the figures, not an instruction. It does not tell you
        what to do, and it can be wrong.
      </p>
    </section>
  );
}
