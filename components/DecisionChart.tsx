"use client";

import { useMemo } from "react";
import type { Data, Layout } from "plotly.js";
import type { Answer } from "@/lib/jev";
import PlotChart from "@/components/PlotChart";
import { BASE_LAYOUT, PLOT, axisCommon } from "@/lib/chart-theme";
import { pct } from "@/components/primitives";

/* ==========================================================================
   Decision charts. Every trace is drawn against the same 0–100 axis as the
   static measures, so a number read here and a number read there mean the
   same thing. Bars fill via marker colour, not width animation.
   ========================================================================== */

const MARGIN = { l: 4, r: 4, t: 4, b: 4 };

/* -------------------------------------------------------------------- noul */

function NoulChart({ answer }: { answer: Extract<Answer, { type: "noul" }> }) {
  const p = answer.noul;

  const { data, layout, height } = useMemo(() => {
    const d: Data[] = [
      {
        type: "bar",
        orientation: "h",
        x: [p * 100],
        y: ["p(true)"],
        marker: { color: PLOT.signal },
        width: 0.5,
        hovertemplate: "%{x:.1f}% probability<extra></extra>",
      },
      {
        // The complement, so the bar reads as a proportion of a whole.
        type: "bar",
        orientation: "h",
        x: [(1 - p) * 100],
        y: ["p(true)"],
        marker: { color: PLOT.paperSunk },
        width: 0.5,
        hoverinfo: "skip",
      },
    ];
    const l: Layout = {
      ...BASE_LAYOUT,
      barmode: "stack",
      // Bottom margin leaves room for Plotly's own 0-100 tick labels — the
      // chart owns the axis, so nothing is drawn beneath it.
      margin: { l: 2, r: 2, t: 2, b: 22 },
      xaxis: { ...axisCommon(), range: [0, 100], dtick: 25, ticksuffix: "%" },
      yaxis: { showgrid: false, showticklabels: false, zeroline: false, fixedrange: true },
    };
    return { data: d, layout: l, height: 92 };
  }, [p]);

  return (
    <PlotChart
      data={data}
      layout={layout}
      height={height}
      ariaLabel={`Probability true: ${pct(p)}. Bar spans the full 0 to 100 scale.`}
    />
  );
}

/* ------------------------------------------------------------------ choice */

function ChoiceChart({ answer }: { answer: Extract<Answer, { type: "choice" }> }) {
  const entries = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);

  const { data, layout, height } = useMemo(() => {
    // Plotly draws the first y-category at the bottom, so reverse the
    // already-descending list to keep the winner on top.
    const rows = [...entries].reverse();
    const d: Data[] = [
      {
        type: "bar",
        orientation: "h",
        x: rows.map(([, p]) => p * 100),
        y: rows.map(([label]) => label),
        marker: {
          color: rows.map(([label]) => (label === answer.choice ? PLOT.signal : PLOT.ink)),
          line: { color: PLOT.paper, width: 1 },
        },
        hovertemplate: "%{y}<br>%{x:.1f}%<extra></extra>",
      },
    ];
    const l: Layout = {
      ...BASE_LAYOUT,
      bargap: 0.34,
      margin: { ...MARGIN, l: 4, r: 4, b: 22 },
      xaxis: { ...axisCommon(), range: [0, 100], dtick: 25 },
      yaxis: {
        showgrid: false,
        zeroline: false,
        fixedrange: true,
        automargin: true,
        tickfont: { size: 11.5, color: PLOT.inkSoft },
      },
    };
    return { data: d, layout: l, height: Math.max(120, entries.length * 34 + 46) };
  }, [entries, answer.choice]);

  const summary = entries
    .map(([label, p]) => `${label} ${pct(p)}`)
    .join(", ");

  return (
    <PlotChart
      data={data}
      layout={layout}
      height={height}
      ariaLabel={`Distribution across ${entries.length} options. ${summary}.`}
    />
  );
}

/* ------------------------------------------------------------------- score */

function ScoreChart({ answer }: { answer: Extract<Answer, { type: "score" }> }) {
  const levels = Object.entries(answer.legend).sort((a, b) => Number(a[0]) - Number(b[0]));

  const { data, layout, height } = useMemo(() => {
    const d: Data[] = [
      {
        type: "bar",
        x: levels.map(([idx]) => Number(idx)),
        y: levels.map(([idx]) => (answer.probabilities[idx] ?? 0) * 100),
        marker: {
          color: levels.map((_, i) =>
            i === Math.round(answer.score) ? PLOT.signal : PLOT.ink,
          ),
          line: { color: PLOT.paper, width: 1 },
        },
        hovertemplate: "level %{x}<br>%{y:.1f}%<extra></extra>",
      },
    ];
    const l: Layout = {
      ...BASE_LAYOUT,
      bargap: 0.28,
      margin: { ...MARGIN, t: 10 },
      xaxis: {
        ...axisCommon(),
        showgrid: false,
        tickmode: "array",
        tickvals: levels.map(([idx]) => Number(idx)),
        ticktext: levels.map(([idx]) => idx),
        title: { text: "scale level", font: { size: 10, color: PLOT.inkFaint }, standoff: 8 },
      },
      yaxis: {
        ...axisCommon(),
        range: [0, 100],
        dtick: 25,
        ticksuffix: "%",
        title: { text: "probability mass", font: { size: 10, color: PLOT.inkFaint }, standoff: 6 },
      },
      // Expected value, drawn across the scale it was computed on.
      shapes: [
        {
          type: "line",
          x0: answer.score,
          x1: answer.score,
          y0: 0,
          y1: 1,
          yref: "paper",
          line: { color: PLOT.signalBright, width: 1.5, dash: "dot" },
        },
      ],
      annotations: [
        {
          x: answer.score,
          y: 1,
          yref: "paper",
          yanchor: "bottom",
          text: `E[score] ${answer.score.toFixed(2)}`,
          showarrow: false,
          font: { size: 11.5, color: PLOT.signal },
          xanchor: answer.score > levels.length * 0.6 ? "right" : "left",
          xshift: answer.score > levels.length * 0.6 ? -4 : 4,
        },
      ],
    };
    return { data: d, layout: l, height: 240 };
  }, [levels, answer.probabilities, answer.score]);

  const summary = levels
    .map(([idx, desc]) => `level ${idx} (${desc}) ${pct(answer.probabilities[idx] ?? 0)}`)
    .join(", ");

  return (
    <PlotChart
      data={data}
      layout={layout}
      height={height}
      ariaLabel={`Probability mass across ${levels.length} scale levels. Expected score ${answer.score.toFixed(2)}. ${summary}.`}
    />
  );
}

/* ---------------------------------------------------------------- dispatch */

export default function DecisionChart({ answer }: { answer: Answer }) {
  if (answer.type === "noul") return <NoulChart answer={answer} />;
  if (answer.type === "choice") return <ChoiceChart answer={answer} />;
  return <ScoreChart answer={answer} />;
}
