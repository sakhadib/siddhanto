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
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0"
    >
      <p className="flex-1 text-xs leading-relaxed text-zinc-600">
        By using Siddhanto you agree to our{" "}
        <a href="/privacy" className="font-medium text-red-600 underline">
          Privacy &amp; Data policy
        </a>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss privacy notice"
        className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
    </div>
  );
}
