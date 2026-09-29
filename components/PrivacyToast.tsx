"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "siddhanto-privacy-ack";

export default function PrivacyToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true); // storage blocked — show once per page load
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="rise fixed inset-x-4 bottom-4 z-50 border border-rule-strong bg-paper-raised p-4 shadow-panel sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-80"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
        <p className="font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase">
          Before you begin
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss privacy notice"
          className="press -mt-0.5 px-1 font-mono text-sm leading-none text-ink-ghost hover:text-signal"
        >
          ×
        </button>
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">
        Every submission is recorded, including the ones the model rejects, and you can
        optionally rate a response or leave a note. Read the{" "}
        <a
          href="/privacy"
          className="text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-signal"
        >
          privacy &amp; data policy
        </a>{" "}
        to see exactly what is kept.
      </p>
    </div>
  );
}
