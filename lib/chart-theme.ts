/* ==========================================================================
   Chart theme — the sRGB resolution of the tokens in app/globals.css.
   Plotly parses colours with its own colour engine that predates oklch(), so
   the chart layer needs literal hex. Keep these in step with globals.css;
   the contrast figures below are measured against --color-paper (#f9f7f3).

     ink        17.4:1     ink-soft    7.9:1     ink-faint  4.7:1
     signal      5.4:1     (ink-ghost  3.2:1 — rules and ticks only, never text)
   ========================================================================== */

export const PLOT = {
  paper: "#f9f7f3",
  paperRaised: "#fdfbf9",
  paperSunk: "#f1efea",
  ink: "#15120f",
  inkSoft: "#514c47",
  inkFaint: "#726e69",
  inkGhost: "#8f8b87",
  rule: "#d6d3cf",
  ruleStrong: "#bab5af",
  signal: "#c71e30",
  signalBright: "#e43037",
  signalWash: "#ffe6e2",
} as const;

/** Plotly's own chrome turned off — it would fight the drafting-sheet frame. */
export const CONFIG = {
  displayModeBar: false,
  displaylogo: false,
  responsive: true,
  scrollZoom: false,
  doubleClick: false,
} as const;

/** Shared axis treatment so every chart in the app sits on the same ruler. */
export function axisCommon() {
  return {
    showgrid: true,
    gridcolor: PLOT.rule,
    gridwidth: 1,
    zeroline: false,
    linecolor: PLOT.ruleStrong,
    linewidth: 1,
    ticks: "outside" as const,
    ticklen: 4,
    tickcolor: PLOT.ruleStrong,
    tickfont: { size: 11, color: PLOT.inkFaint },
    fixedrange: true,
    automargin: true,
  };
}

export const BASE_LAYOUT = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  showlegend: false,
  hovermode: "closest" as const,
  dragmode: false as const,
  font: { family: "ui-monospace, monospace", size: 12, color: PLOT.inkSoft },
  hoverlabel: {
    bgcolor: PLOT.paperRaised,
    bordercolor: PLOT.ruleStrong,
    font: { family: "ui-monospace, monospace", size: 12, color: PLOT.ink },
    align: "left" as const,
  },
};
