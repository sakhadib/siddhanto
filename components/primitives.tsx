import type { CSSProperties, ReactNode } from "react";

/* ==========================================================================
   Instrument primitives — the vocabulary that replaces the old card stack.
   Rules, tick scales and tabular readouts instead of boxes, borders and
   shadows. Presentational only; safe to import from server or client.
   ========================================================================== */

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function pct(n: number, digits = 1): string {
  return `${(clamp01(n) * 100).toFixed(digits)}%`;
}

/** Cast a CSSProperties bag carrying custom properties. */
function vars(props: Record<string, string | number>): CSSProperties {
  return props as CSSProperties;
}

/* ---------------------------------------------------------------- titleblock */

/** A drafting title block: small-caps label, a hairline that runs to the
 *  margin, and an optional right-aligned monospace counter. */
export function SectionLabel({
  children,
  meta,
  className = "",
}: {
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <span className="shrink-0 font-mono text-label font-medium tracking-[0.16em] text-ink uppercase">
        {children}
      </span>
      <span aria-hidden className="h-px flex-1 bg-rule" />
      {meta !== undefined && (
        <span className="tnum shrink-0 font-mono text-meta text-ink-faint">{meta}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- axis */

const TICKS = [0, 25, 50, 75, 100] as const;

/** The 0–100 scale beneath every measure. Major ticks at 0/50/100, minor
 *  at the quarters — the same ruler for every number in the app. */
export function Axis({ labels = true }: { labels?: boolean }) {
  return (
    <div aria-hidden className="relative mt-1.5 h-3 select-none">
      {TICKS.map((t) => {
        const major = t === 0 || t === 50 || t === 100;
        return (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${t}%`, transform: t === 0 ? "translateX(0)" : t === 100 ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            <span className={`block w-px ${major ? "h-1.5 bg-rule-strong" : "h-1 bg-rule"}`} />
            {labels && (
              <span className="tnum mt-1 font-mono text-tick leading-none whitespace-nowrap text-ink-faint">
                {t}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- measure */

/** A single value read against the 0–100 scale. The channel is a groove with
 *  hairline edges; the fill animates via transform; a needle marks the value. */
export function MeasureBar({
  value,
  tone = "ink",
  i = 0,
  showAxis = true,
}: {
  value: number;
  tone?: "ink" | "signal";
  i?: number;
  showAxis?: boolean;
}) {
  const v = clamp01(value);
  return (
    <div>
      <div className="relative h-2.5 overflow-hidden border-y border-rule-strong bg-paper-sunk">
        <div
          className={`measure absolute inset-y-0 left-0 w-full ${
            tone === "signal" ? "bg-signal" : "bg-ink"
          }`}
          style={vars({ "--target": v, "--i": i })}
        />
        <div
          aria-hidden
          className="absolute inset-y-[-4px] w-px bg-signal-bright"
          style={{ left: `${v * 100}%` }}
        />
      </div>
      {showAxis && <Axis />}
    </div>
  );
}

/** The instrument's primary number. Oversized, tabular, monospaced. */
export function Readout({
  label,
  value,
  unit,
  i = 0,
}: {
  label: string;
  value: string;
  unit?: string;
  i?: number;
}) {
  return (
    <div className="rise" style={vars({ "--i": i })}>
      <p className="font-mono text-label font-medium tracking-[0.16em] text-ink-soft uppercase">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="tnum font-mono text-[clamp(2.5rem,6vw,3.75rem)] leading-[0.9] font-medium tracking-tighter text-ink">
          {value}
        </span>
        {unit && <span className="font-mono text-sm text-ink-faint">{unit}</span>}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- fields */

/** Underline-only control. The drafting-sheet answer to a rounded input box:
 *  no fill, no shadow, a single hairline that the accent takes over on focus. */
export function Field({
  label,
  meta,
  hint,
  className = "",
  textarea = false,
  ...rest
}: {
  label: string;
  meta?: ReactNode;
  hint?: string;
  className?: string;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const control =
    "channel peer w-full resize-none px-3 py-2.5 text-base leading-relaxed text-ink";
  const shared = { ...rest, className: control };

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="font-mono text-label font-medium tracking-[0.16em] text-ink uppercase">
          {label}
        </label>
        {meta !== undefined && (
          <span className="tnum font-mono text-meta text-ink-faint">{meta}</span>
        )}
      </div>
      {textarea ? <textarea rows={3} {...(shared as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} /> : <input {...(shared as React.InputHTMLAttributes<HTMLInputElement>)} />}
      {hint && <p className="mt-2 max-w-[58ch] text-note text-ink-faint">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- button */

export function InkButton({
  children,
  pending,
  pendingLabel,
  ...rest
}: {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || pending}
      className="press group relative w-full overflow-hidden border-2 border-ink bg-ink px-6 py-4 font-mono text-[15px] tracking-[0.18em] text-paper uppercase disabled:cursor-not-allowed disabled:border-rule-strong disabled:bg-transparent disabled:text-ink-ghost"
    >
      {pending && (
        <span aria-hidden className="sweep absolute inset-0" />
      )}
      <span className="relative">
        {pending ? (pendingLabel ?? "Reading…") : children}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ notices */

export function Notice({
  tone = "signal",
  children,
}: {
  tone?: "signal" | "neutral";
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`border-l-2 py-1.5 pl-3 text-note ${
        tone === "signal" ? "border-signal text-signal" : "border-rule-strong text-ink-soft"
      }`}
    >
      {children}
    </div>
  );
}
