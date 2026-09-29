"use client";

import { useEffect, useRef, useState } from "react";
import type { Config, Data, Layout } from "plotly.js";
import { CONFIG, PLOT } from "@/lib/chart-theme";

type PlotlyApi = typeof import("plotly.js").default;

/** Resolves the next/font-generated monospace stack so chart labels match the
 *  rest of the app. Falls back to the platform mono if the variable is absent. */
function monoStack(): string {
  if (typeof window === "undefined") return "ui-monospace, monospace";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-plex-mono")
    .trim();
  return v || "ui-monospace, monospace";
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="sweep absolute inset-0 overflow-hidden border-y border-rule bg-paper-sunk" style={{ height }} aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
    </div>
  );
}

/**
 * Lazily-mounted Plotly surface.
 *
 * The library is only ever reached through a dynamic import, so it stays out
 * of the initial bundle and does not load at all until a decision comes back.
 * The host div is mounted (and sized) from the first frame so Plotly measures
 * a real width; the skeleton simply overlays it until the module resolves.
 */
export default function PlotChart({
  data,
  layout,
  height = 220,
  className = "",
  ariaLabel,
}: {
  data: Data[];
  layout: Layout;
  height?: number;
  className?: string;
  ariaLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [plotly, setPlotly] = useState<PlotlyApi | null>(null);

  useEffect(() => {
    let alive = true;
    import("@/lib/plotly").then((m) => {
      if (alive) setPlotly(m.default);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!plotly || !el) return;
    const font = { family: monoStack(), size: 12, color: PLOT.inkSoft };
    plotly.react(el, data, { ...layout, font }, CONFIG);
    return () => {
      plotly.purge(el);
    };
  }, [plotly, data, layout]);

  return (
    <div className={`relative ${className}`} style={{ height }} role="img" aria-label={ariaLabel}>
      <div ref={host} className="h-full w-full" />
      {!plotly && <ChartSkeleton height={height} />}
    </div>
  );
}
