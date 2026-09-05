export const POINT_LABEL_FONT_SIZE = 9.4;

export const FIGURE_SVG_CSS = `
svg.plot-svg { background: #ffffff; font-family: Arial, Helvetica, sans-serif; }
.plot-area { fill: #fcfdfc; }
.grid-line { stroke: #e4e8e2; stroke-width: 0.6; }
.minor-grid-line { stroke: rgba(216, 222, 214, 0.58); stroke-width: 0.42; stroke-dasharray: 1.6 3.2; vector-effect: non-scaling-stroke; }
.axis-line, .axis-tick { stroke: #171a16; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
.axis-text { fill: #4f564f; font-family: Arial, Helvetica, sans-serif; font-size: 10.8px; font-style: normal; font-variant-numeric: tabular-nums; }
.axis-title { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 12.2px; font-style: normal; font-weight: 700; }
.plot-ashby .plot-area { fill: #ffffff; }
.plot-ashby .minor-grid-line { display: none; }
.plot-ashby .grid-line { stroke: #dce1dc; stroke-width: 0.55; }
.ashby-region { fill-opacity: 0.28; stroke-opacity: 0.94; stroke-width: 1.8; stroke-linejoin: round; stroke-dasharray: none; vector-effect: non-scaling-stroke; pointer-events: none; }
path.ashby-region-cnt { fill: #0072b2; stroke: #004f7a; }
path.ashby-region-cnt-metal { fill: #d55e00; stroke: #8c3e00; }
path.ashby-region-graphene { fill: #009e73; stroke: #006b4f; }
path.ashby-region-carbon-fiber { fill: #4a4a4a; stroke: #202020; }
path.ashby-region-other-carbon { fill: #8a8a8a; stroke: #5c5c5c; }
path.ashby-region-polymer { fill: #e69f00; stroke: #9a6a00; }
path.ashby-region-metal { fill: #cc79a7; stroke: #8c4d73; }
path.ashby-region-ceramic { fill: #6a3d9a; stroke: #432667; }
path.ashby-region-unknown { fill: #979d95; stroke: #60665f; }
.ashby-region-legend-box { fill: #ffffff; fill-opacity: 0.97; stroke: #b8c0b8; stroke-width: 0.8; vector-effect: non-scaling-stroke; }
.ashby-region-legend-title { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 9.2px; font-weight: 700; letter-spacing: 0; }
.ashby-region-legend-text { fill: #333a34; font-family: Arial, Helvetica, sans-serif; font-size: 10.2px; font-weight: 600; }
.ashby-region-legend-swatch { fill-opacity: 0.28; stroke-opacity: 0.94; stroke-width: 1.25; vector-effect: non-scaling-stroke; }
.plot-point { cursor: pointer; stroke-width: 1.2; vector-effect: non-scaling-stroke; opacity: 0.95; }
.plot-point.is-selected { stroke-width: 1.8; opacity: 1; stroke-dasharray: none; }
.plot-point.point-material-cnt { fill: #0072b2; stroke: #004f7a; }
.plot-point.point-material-cnt-metal { fill: #d55e00; stroke: #8c3e00; }
.plot-point.point-material-graphene { fill: #009e73; stroke: #006b4f; }
.plot-point.point-material-carbon-fiber { fill: #4a4a4a; stroke: #202020; }
.plot-point.point-material-other-carbon { fill: #8a8a8a; stroke: #5c5c5c; }
.plot-point.point-material-polymer { fill: #e69f00; stroke: #9a6a00; }
.plot-point.point-material-metal { fill: #cc79a7; stroke: #8c4d73; }
.plot-point.point-material-ceramic { fill: #6a3d9a; stroke: #432667; }
.plot-point.point-material-unknown { fill: #979d95; stroke: #60665f; }
.plot-point.point-shape-open-circle.point-material-cnt { fill: #ffffff; stroke: #0072b2; }
.plot-point.point-shape-open-circle.point-material-cnt-metal { fill: #ffffff; stroke: #d55e00; }
.plot-point.point-shape-open-circle.point-material-graphene { fill: #ffffff; stroke: #009e73; }
.plot-point.point-shape-open-circle.point-material-carbon-fiber { fill: #ffffff; stroke: #4a4a4a; }
.plot-point.point-shape-open-circle.point-material-other-carbon { fill: #ffffff; stroke: #8a8a8a; }
.plot-point.point-shape-open-circle.point-material-polymer { fill: #ffffff; stroke: #e69f00; }
.plot-point.point-shape-open-circle.point-material-metal { fill: #ffffff; stroke: #cc79a7; }
.plot-point.point-shape-open-circle.point-material-ceramic { fill: #ffffff; stroke: #6a3d9a; }
.plot-point.point-shape-open-circle.point-material-unknown { fill: #ffffff; stroke: #979d95; }
.point-label { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: ${POINT_LABEL_FONT_SIZE}px; font-weight: 700; paint-order: stroke; stroke: rgba(252, 253, 252, 0.95); stroke-width: 2.8px; }
.label-leader { stroke: rgba(23, 26, 22, 0.38); stroke-width: 0.75; vector-effect: non-scaling-stroke; pointer-events: none; }
.rank-row-line { stroke: rgba(216, 222, 214, 0.58); stroke-width: 0.65; vector-effect: non-scaling-stroke; }
.rank-value-line { stroke: rgba(23, 26, 22, 0.22); stroke-width: 1; vector-effect: non-scaling-stroke; }
.rank-label { fill: #5e645c; font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; font-weight: 650; }
.rank-value-text { fill: #5e645c; font-family: Arial, Helvetica, sans-serif; font-size: 9.2px; font-variant-numeric: tabular-nums; }
.rank-reference-line { stroke: rgba(23, 26, 22, 0.42); stroke-dasharray: 4 4; stroke-width: 1.05; vector-effect: non-scaling-stroke; pointer-events: none; }
.rank-reference-leader { stroke: rgba(23, 26, 22, 0.34); stroke-width: 0.85; vector-effect: non-scaling-stroke; pointer-events: none; }
.rank-reference-tag { fill: rgba(251, 251, 250, 0.94); stroke: rgba(23, 26, 22, 0.24); stroke-width: 0.8; vector-effect: non-scaling-stroke; pointer-events: none; }
.rank-reference-label { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 11.4px; font-weight: 760; letter-spacing: 0; pointer-events: none; }
.rank-reference-line.reference-copper, .rank-reference-leader.reference-copper { stroke: #b36a34; }
.rank-reference-tag.reference-copper { stroke: rgba(179, 106, 52, 0.7); }
.rank-reference-label.reference-copper { fill: #8a471f; }
.rank-reference-line.reference-silver, .rank-reference-leader.reference-silver { stroke: #8f9aa3; }
.rank-reference-tag.reference-silver { stroke: rgba(143, 154, 163, 0.78); }
.rank-reference-label.reference-silver { fill: #68727a; }
.rank-reference-line.reference-aluminum, .rank-reference-leader.reference-aluminum { stroke: #5f6f7c; }
.rank-reference-tag.reference-aluminum { stroke: rgba(95, 111, 124, 0.78); }
.rank-reference-label.reference-aluminum { fill: #4d5a64; }
.rank-reference-line.reference-aramid, .rank-reference-leader.reference-aramid { stroke: #7f6a00; }
.rank-reference-tag.reference-aramid { stroke: rgba(127, 106, 0, 0.72); }
.rank-reference-label.reference-aramid { fill: #695800; }
.rank-reference-line.reference-pbo, .rank-reference-leader.reference-pbo { stroke: #8d3f86; }
.rank-reference-tag.reference-pbo { stroke: rgba(141, 63, 134, 0.72); }
.rank-reference-label.reference-pbo { fill: #75336f; }
.rank-reference-line.reference-carbon-reference, .rank-reference-leader.reference-carbon-reference, .rank-reference-line.reference-hm-carbon, .rank-reference-leader.reference-hm-carbon { stroke: #333b3a; }
.rank-reference-tag.reference-carbon-reference, .rank-reference-tag.reference-hm-carbon { stroke: rgba(51, 59, 58, 0.7); }
.rank-reference-label.reference-carbon-reference, .rank-reference-label.reference-hm-carbon { fill: #2f3735; }
.temporary-point { fill: #151a17; stroke: #ffffff; stroke-width: 1.1; vector-effect: non-scaling-stroke; }
.temporary-point-label { fill: #151a17; font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 700; paint-order: stroke; stroke: rgba(252, 253, 252, 0.96); stroke-width: 3px; }
.temporary-rank-line { stroke: #151a17; stroke-width: 1.05; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
.export-legend { display: block; }
.export-legend-heading { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 9.2px; font-weight: 700; letter-spacing: 0; }
.export-legend-text { fill: #4f574e; font-family: Arial, Helvetica, sans-serif; font-size: 9.4px; font-weight: 500; }
.export-legend-symbol { stroke-width: 1.05; vector-effect: non-scaling-stroke; }
.export-legend-material.point-material-cnt { fill: #0072b2; stroke: #004f7a; }
.export-legend-material.point-material-cnt-metal { fill: #d55e00; stroke: #8c3e00; }
.export-legend-material.point-material-graphene { fill: #009e73; stroke: #006b4f; }
.export-legend-material.point-material-carbon-fiber { fill: #4a4a4a; stroke: #202020; }
.export-legend-material.point-material-other-carbon { fill: #8a8a8a; stroke: #5c5c5c; }
.export-legend-material.point-material-polymer { fill: #e69f00; stroke: #9a6a00; }
.export-legend-material.point-material-metal { fill: #cc79a7; stroke: #8c4d73; }
.export-legend-material.point-material-ceramic { fill: #6a3d9a; stroke: #432667; }
.export-legend-form { fill: #646c64; stroke: #646c64; }
.export-legend-form.point-shape-open-circle { fill: #ffffff; stroke: #646c64; }
`;
