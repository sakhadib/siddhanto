// Partial Plotly bundle: core + the bar trace only. Importing the default
// `plotly.js` entry would pull every trace type (~4.6 MB minified) onto a
// mobile-first page. This module is only ever reached through a dynamic
// import in components/PlotChart, so it never lands in the initial payload.
import Plotly from "plotly.js/lib/core";
import PlotlyBar from "plotly.js/lib/bar";

Plotly.register([PlotlyBar]);

export default Plotly;
