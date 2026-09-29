"use client";

import { useState } from "react";
import { Field, InkButton, Notice } from "./primitives";
import { DRAFT_STAGES, StageList, useStages } from "@/lib/phase";
import type { Question } from "@/lib/validate";

/* ==========================================================================
   The composer is a way IN, not a way to a number.

   It hands back a filled form and stops there. No model behind it produces a
   probability — it only decides what the questions should be, and the author
   gets to change every word of that before JEV is called. The copy says so,
   because a feature that merely *looks* like it produces answers is the most
   misleading thing a page like this could add.
   ========================================================================== */

const MAX_MESSAGES = 8;

export interface DraftPayload {
  state: string;
  questions: Question[];
}

export default function Drafter({
  current,
  onDraft,
}: {
  /** The form as it stands, so a follow-up revises it instead of starting over. */
  current: DraftPayload;
  onDraft: (d: DraftPayload) => void;
}) {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "drafting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [drafted, setDrafted] = useState(false);

  const busy = phase === "drafting";
  const stage = useStages(DRAFT_STAGES, busy);
  const full = messages.length >= MAX_MESSAGES;
  const canSend = input.trim().length > 0 && !busy && !full;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, text];
    setMessages(next);
    setInput("");
    setPhase("drafting");
    setError(null);

    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, current }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // The message stays in the transcript so it can be retried or amended
        // rather than retyped.
        setMessages(messages);
        setInput(text);
        setError(data?.error ?? "Could not turn that into a form.");
        setPhase("error");
        return;
      }

      onDraft({
        state: String(data.state ?? ""),
        questions: (data.questions ?? []) as Question[],
      });
      setDrafted(true);
      setPhase("idle");
    } catch {
      setMessages(messages);
      setInput(text);
      setError("Network error. Your text is still here.");
      setPhase("error");
    }
  }

  function clear() {
    setMessages([]);
    setInput("");
    setError(null);
    setPhase("idle");
    setDrafted(false);
  }

  return (
    <section
      aria-labelledby="drafter-label"
      className="flex flex-col gap-5 pt-1"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="drafter-label"
          className="font-mono text-label font-medium tracking-[0.16em] text-ink uppercase"
        >
          Or just describe it
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="font-mono text-meta tracking-[0.14em] text-ink-faint uppercase transition-colors hover:text-signal"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-3 max-w-[54ch] text-note text-ink-soft">
        Say the situation and what you want weighed against what, in ordinary words. It is
        turned into the form below for you to correct. Nothing is answered until you press
        Decide.
      </p>

      {messages.length > 0 && (
        <ol className="mt-5 flex flex-col gap-3">
          {messages.map((m, i) => (
            <li key={i} className="border-l-2 border-ink-faint pl-3">
              <span className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
                You
              </span>
              <p className="mt-1 max-w-[54ch] text-note whitespace-pre-wrap text-ink-soft">
                {m}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5">
        <Field
          label={messages.length === 0 ? "Your description" : "Add or change something"}
          textarea
          rows={messages.length === 0 ? 4 : 3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter is a newline. Drafting is a committed
            // model call, so it should not fire on a stray keypress mid-sentence.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) void send();
            }
          }}
          placeholder="I want to buy a used bike for $500. The seller wants bank transfer and the photos look reused. Should I treat it as a scam, risky, or fine?"
          maxLength={2000}
        />
      </div>

      {error && (
        <div>
          <Notice>{error}</Notice>
        </div>
      )}

      {busy && <StageList stage={stage} />}

      {drafted && !busy && !error && (
        <div className="mt-4">
          <Notice tone="neutral">
            The form below is filled in. Read it, change anything that is off, then press
            Decide.
          </Notice>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <InkButton onClick={() => void send()} disabled={!canSend}>
          {drafted ? "Redraft from this" : "Fill the form"}
        </InkButton>
        {full && (
          <p className="max-w-[52ch] text-note text-ink-faint">
            That is the most this will hold ({MAX_MESSAGES}). Clear it to start over.
          </p>
        )}
      </div>
    </section>
  );
}
