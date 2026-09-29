// plotly.js ships types for its default entry only; the composable
// lib/core + lib/bar path used to keep a partial bundle needs a shim.
declare module "plotly.js/lib/core" {
  const Plotly: typeof import("plotly.js").default;
  export default Plotly;
}

declare module "plotly.js/lib/bar" {
  const PlotlyBar: Parameters<typeof import("plotly.js").default.register>[0][number];
  export default PlotlyBar;
}
