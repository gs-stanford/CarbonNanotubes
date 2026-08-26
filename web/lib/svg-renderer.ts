import { stripMarkup } from "@/lib/citations";
import { PROPERTY_BY_KEY, type PlotRecord, type PropertyKey, type ScaleMode } from "@/lib/data";
import type { FigureKind, FigureTemporaryPoint } from "@/lib/figure-api";
import type { ComparabilityGrade } from "@/lib/comparability";
import { FIGURE_SVG_CSS } from "@/lib/figure-style";

export type FigureReferenceLine = {
  label: string;
  value: number;
  className?: string;
};

export type SvgFigureOptions = {
  records: PlotRecord[];
  kind: FigureKind;
  x: PropertyKey;
  y: PropertyKey;
  xScale: ScaleMode;
  yScale: ScaleMode;
  selectedId: string | null;
  highlightedIds: Set<string>;
  temporary: FigureTemporaryPoint | null;
  referenceLines: FigureReferenceLine[];
  interactive: boolean;
  comparabilityGrades: Map<string, ComparabilityGrade>;
  documentMetadata: {
    releaseId: string;
    sourceHash: string | null;
    comparabilityModel: string;
    comparabilityDisclosure: string;
  };
};

type Point = { x: number; y: number };
type Box = { x0: number; y0: number; x1: number; y1: number };
type Tick = { value: number; position: number; label: string };
type MarkerShape = "circle" | "open-circle" | "square" | "diamond" | "triangle" | "down-triangle" | "hexagon";

const WIDTH = 920;
const HEIGHT = 632;
const BASE_MARGIN = { top: 112, right: 36, bottom: 72, left: 92 };
const LINEAR_TICK_TARGET = 6;
const AUTHOR_PARTICLES = new Set(["da", "de", "del", "della", "der", "di", "dos", "du", "la", "le", "van", "von", "y"]);

const FAMILY_LABELS: Record<string, string> = {
  CNT_or_CNT_hybrid: "CNT",
  CNT_metal_composite: "CNT-metal composite",
  graphene_or_GO_fiber: "Graphene / graphite",
  carbon_fiber_comparator: "Carbon fiber",
  other_carbon_comparator: "Other carbon",
  polymer_fiber_comparator: "Polymer",
  metal_comparator: "Metal",
  ceramic_or_glass_comparator: "Ceramic / glass"
};

const FAMILY_ORDER = [
  "carbon_fiber_comparator",
  "ceramic_or_glass_comparator",
  "CNT_or_CNT_hybrid",
  "CNT_metal_composite",
  "graphene_or_GO_fiber",
  "metal_comparator",
  "other_carbon_comparator",
  "polymer_fiber_comparator"
];

const FAMILY_COLORS: Record<string, { fill: string; stroke: string }> = {
  CNT_or_CNT_hybrid: { fill: "#0072b2", stroke: "#004f7a" },
  CNT_metal_composite: { fill: "#d55e00", stroke: "#8c3e00" },
  graphene_or_GO_fiber: { fill: "#009e73", stroke: "#006b4f" },
  carbon_fiber_comparator: { fill: "#4a4a4a", stroke: "#202020" },
  other_carbon_comparator: { fill: "#8a8a8a", stroke: "#5c5c5c" },
  polymer_fiber_comparator: { fill: "#e69f00", stroke: "#9a6a00" },
  metal_comparator: { fill: "#cc79a7", stroke: "#8c4d73" },
  ceramic_or_glass_comparator: { fill: "#6a3d9a", stroke: "#432667" }
};

const FAMILY_POINT_CLASSES: Record<string, string> = {
  CNT_or_CNT_hybrid: "point-material-cnt",
  CNT_metal_composite: "point-material-cnt-metal",
  graphene_or_GO_fiber: "point-material-graphene",
  carbon_fiber_comparator: "point-material-carbon-fiber",
  other_carbon_comparator: "point-material-other-carbon",
  polymer_fiber_comparator: "point-material-polymer",
  metal_comparator: "point-material-metal",
  ceramic_or_glass_comparator: "point-material-ceramic"
};

const FORM_LABELS: Record<string, string> = {
  buckypaper: "Buckypaper",
  fiber_yarn: "Fiber / yarn",
  foam_aerogel: "Foam / aerogel",
  forest_array: "Forest / array",
  individual_nanotube_or_bundle: "Individual tube / bundle",
  sheet_mat_film: "Sheet / mat / film",
  bulk: "Bulk",
  unknown: "Unknown"
};

const FORM_ORDER = [
  "buckypaper",
  "fiber_yarn",
  "foam_aerogel",
  "forest_array",
  "individual_nanotube_or_bundle",
  "sheet_mat_film",
  "bulk",
  "unknown"
];

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

const SUPERSCRIPT_ASCII: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-"
};

function scientificTextMarkup(value: string): string {
  let output = "";
  let plain = "";
  let superscript = "";
  const flushPlain = () => {
    output += xml(plain);
    plain = "";
  };
  const flushSuperscript = () => {
    if (!superscript) return;
    output += `<tspan baseline-shift="super" font-size="8.4">${xml(superscript)}</tspan>`;
    superscript = "";
  };

  for (const character of value) {
    const mapped = SUPERSCRIPT_ASCII[character];
    if (mapped !== undefined) {
      flushPlain();
      superscript += mapped;
    } else {
      flushSuperscript();
      plain += character;
    }
  }
  flushSuperscript();
  flushPlain();
  return output;
}

function finite(record: PlotRecord, property: PropertyKey): number | null {
  const value = record.values[property];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;
  if (fraction <= 1) return base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 2.5) return 2.5 * base;
  if (fraction <= 5) return 5 * base;
  return 10 * base;
}

function extent(values: number[], scale: ScaleMode, forceZero = false): [number, number] {
  const valid = values.filter((value) => Number.isFinite(value) && (scale === "linear" || value > 0));
  if (!valid.length) return scale === "log" ? [1, 10] : [0, 1];
  let minimum = Math.min(...valid);
  let maximum = Math.max(...valid);
  if (minimum === maximum) {
    if (scale === "log") {
      minimum /= 3;
      maximum *= 3;
    } else {
      maximum += Math.max(Math.abs(maximum) * 0.15, 1);
      minimum = forceZero || minimum >= 0 ? 0 : minimum - Math.max(Math.abs(minimum) * 0.15, 1);
    }
  }
  if (scale === "log") {
    return [10 ** Math.floor(Math.log10(minimum)), 10 ** Math.ceil(Math.log10(maximum))];
  }
  const allNonNegative = valid.every((value) => value >= 0);
  const span = Math.max(maximum - minimum, Math.abs(maximum), 1);
  const step = niceStep(span / (LINEAR_TICK_TARGET - 1));
  const lower = forceZero || allNonNegative ? 0 : Math.floor((minimum - span * 0.04) / step) * step;
  let upper = Math.ceil((maximum + span * 0.04) / step) * step;
  if (upper <= lower) upper = lower + step * (LINEAR_TICK_TARGET - 1);
  return [lower, upper];
}

function scaleNumber(value: number, domain: [number, number], range: [number, number], mode: ScaleMode): number {
  const numerator = mode === "log" ? Math.log10(value) - Math.log10(domain[0]) : value - domain[0];
  const denominator = mode === "log" ? Math.log10(domain[1]) - Math.log10(domain[0]) : domain[1] - domain[0];
  return range[0] + (numerator / Math.max(denominator, Number.EPSILON)) * (range[1] - range[0]);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 10000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
    return value.toExponential(0).replace("e+", "e");
  }
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) return rounded.toLocaleString("en-US");
  if (Math.abs(value) >= 100) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (Math.abs(value) >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-US", { maximumSignificantDigits: 2 });
}

function ticks(domain: [number, number], range: [number, number], mode: ScaleMode): Tick[] {
  if (mode === "log") {
    const start = Math.ceil(Math.log10(domain[0]));
    const end = Math.floor(Math.log10(domain[1]));
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
      const value = 10 ** (start + index);
      return { value, position: scaleNumber(value, domain, range, mode), label: formatNumber(value) };
    });
  }
  const step = niceStep((domain[1] - domain[0]) / (LINEAR_TICK_TARGET - 1));
  const start = Math.ceil(domain[0] / step) * step;
  const values: number[] = [];
  for (let value = start; value <= domain[1] + step * 0.25; value += step) values.push(Number(value.toPrecision(12)));
  return values.map((value) => ({ value, position: scaleNumber(value, domain, range, mode), label: formatNumber(value) }));
}

function minorTicks(domain: [number, number], range: [number, number], mode: ScaleMode): Tick[] {
  if (mode !== "log") return [];
  const values: Tick[] = [];
  for (let exponent = Math.floor(Math.log10(domain[0])); exponent <= Math.ceil(Math.log10(domain[1])); exponent += 1) {
    const decade = 10 ** exponent;
    for (let multiple = 2; multiple < 10; multiple += 1) {
      const value = multiple * decade;
      if (value > domain[0] && value < domain[1]) values.push({ value, position: scaleNumber(value, domain, range, mode), label: "" });
    }
  }
  return values;
}

function markerShape(record: PlotRecord): MarkerShape {
  if (record.form_factor === "fiber_yarn") return "circle";
  if (record.form_factor === "sheet_mat_film") return "down-triangle";
  if (record.form_factor === "buckypaper") return "square";
  if (record.form_factor === "foam_aerogel") return "open-circle";
  if (record.form_factor === "forest_array") return "triangle";
  if (record.form_factor === "individual_nanotube_or_bundle") return "diamond";
  if (record.form_factor === "bulk") return "hexagon";
  return "open-circle";
}

function markerGeometry(shape: MarkerShape, x: number, y: number, radius: number, fill: string, stroke: string, attributes = ""): string {
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="1.15" vector-effect="non-scaling-stroke" ${attributes}`;
  if (shape === "circle" || shape === "open-circle") return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}" ${common}/>`;
  if (shape === "square") return `<rect x="${(x - radius).toFixed(2)}" y="${(y - radius).toFixed(2)}" width="${(radius * 2).toFixed(2)}" height="${(radius * 2).toFixed(2)}" ${common}/>`;
  if (shape === "diamond") return `<path d="M ${x.toFixed(2)} ${(y - radius * 1.35).toFixed(2)} L ${(x + radius * 1.35).toFixed(2)} ${y.toFixed(2)} L ${x.toFixed(2)} ${(y + radius * 1.35).toFixed(2)} L ${(x - radius * 1.35).toFixed(2)} ${y.toFixed(2)} Z" ${common}/>`;
  if (shape === "triangle") return `<path d="M ${x.toFixed(2)} ${(y - radius * 1.35).toFixed(2)} L ${(x + radius * 1.25).toFixed(2)} ${(y + radius).toFixed(2)} L ${(x - radius * 1.25).toFixed(2)} ${(y + radius).toFixed(2)} Z" ${common}/>`;
  if (shape === "down-triangle") return `<path d="M ${(x - radius * 1.25).toFixed(2)} ${(y - radius).toFixed(2)} L ${(x + radius * 1.25).toFixed(2)} ${(y - radius).toFixed(2)} L ${x.toFixed(2)} ${(y + radius * 1.35).toFixed(2)} Z" ${common}/>`;
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index;
    return `${(x + Math.cos(angle) * radius * 1.2).toFixed(2)},${(y + Math.sin(angle) * radius * 1.2).toFixed(2)}`;
  }).join(" ");
  return `<polygon points="${points}" ${common}/>`;
}

function starGeometry(x: number, y: number, radius = 7): string {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const localRadius = index % 2 === 0 ? radius : radius * 0.43;
    return `${(x + Math.cos(angle) * localRadius).toFixed(2)},${(y + Math.sin(angle) * localRadius).toFixed(2)}`;
  }).join(" ");
  return `<polygon class="temporary-point" points="${points}"/>`;
}

function pointMarkup(record: PlotRecord, x: number, y: number, options: SvgFigureOptions): string {
  const color = FAMILY_COLORS[record.material_family] ?? { fill: "#979d95", stroke: "#60665f" };
  const shape = markerShape(record);
  const fill = shape === "open-circle" ? "#ffffff" : color.fill;
  const selected = options.interactive && record.record_id === options.selectedId;
  const highlighted = options.interactive && options.highlightedIds.has(record.record_id);
  const grade = options.comparabilityGrades.get(record.record_id) ?? "D";
  const radius = record.public_release_tier === "peer_reviewed_research" ? 4.4 : 4;
  const pointClasses = [
    "plot-point",
    FAMILY_POINT_CLASSES[record.material_family] ?? "point-material-unknown",
    `point-shape-${shape}`,
    `quality-${grade.toLowerCase()}`,
    selected ? "is-selected" : "",
    highlighted ? "is-search-match" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const attributes = options.interactive
    ? `class="${pointClasses}" data-record-id="${xml(record.record_id)}" data-comparability-grade="${grade}" role="button" tabindex="0" aria-label="${xml(record.public_sample_label || record.record_label)}; comparison grade ${grade}"`
    : `class="${pointClasses}" data-comparability-grade="${grade}"`;
  const layers = [
    highlighted ? `<circle class="search-highlight-halo" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="12" fill="none" stroke="#00a6a6" stroke-width="3.4" opacity="0.88"/>` : "",
    selected ? `<circle class="selected-halo" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="9.5" fill="none" stroke="#126f6d" stroke-width="1.8"/>` : "",
    markerGeometry(shape, x, y, radius, fill, color.stroke, attributes)
  ];
  return `<g>${layers.join("")}</g>`;
}

function legendSymbol(shape: MarkerShape, x: number, y: number, color = "#646c64"): string {
  return markerGeometry(shape, x, y, 3.5, shape === "open-circle" ? "#ffffff" : color, color);
}

function activeKeys(records: PlotRecord[], getter: (record: PlotRecord) => string, order: string[]): string[] {
  const active = new Set(records.map(getter));
  return [...order.filter((key) => active.has(key)), ...[...active].filter((key) => !order.includes(key)).sort()];
}

function renderLegend(records: PlotRecord[], comparabilityGrades: Map<string, ComparabilityGrade>): { markup: string; bottom: number } {
  const familyKeys = activeKeys(records, (record) => record.material_family, FAMILY_ORDER);
  const formKeys = activeKeys(records, (record) => record.form_factor, FORM_ORDER);
  let y = 28;
  const rows: string[] = [];
  const renderRow = (heading: string, items: Array<{ key: string; label: string; symbol: (x: number, y: number) => string }>) => {
    let x = 92;
    rows.push(`<text class="export-legend-heading" x="38" y="${y + 3}">${heading}</text>`);
    for (const item of items) {
      const width = 28 + item.label.length * 5.15;
      if (x + width > WIDTH - 28) {
        y += 24;
        x = 92;
      }
      rows.push(item.symbol(x, y));
      rows.push(`<text class="export-legend-text" x="${x + 10}" y="${y + 3}">${xml(item.label)}</text>`);
      x += width;
    }
    y += 25;
  };
  renderRow("COLOR", familyKeys.map((key) => ({
    key,
    label: FAMILY_LABELS[key] ?? key,
    symbol: (x, itemY) => {
      const color = FAMILY_COLORS[key] ?? { fill: "#979d95", stroke: "#60665f" };
      return `<circle cx="${x}" cy="${itemY}" r="3.7" fill="${color.fill}" stroke="${color.stroke}" stroke-width="1"/>`;
    }
  })));
  renderRow("SHAPE", formKeys.map((key) => ({
    key,
    label: FORM_LABELS[key] ?? key,
    symbol: (x, itemY) => legendSymbol(markerShape({ form_factor: key } as PlotRecord), x, itemY)
  })));
  const activeGrades = (["A", "B", "C", "D"] as ComparabilityGrade[])
    .filter((grade) => records.some((record) => comparabilityGrades.get(record.record_id) === grade));
  renderRow("EVIDENCE", activeGrades.map((grade) => ({
    key: grade,
    label: ({ A: "A paired + complete", B: "B qualified", C: "C exploratory", D: "D context-only" } as const)[grade],
    symbol: (x, itemY) => `<circle class="plot-point quality-${grade.toLowerCase()}" cx="${x}" cy="${itemY}" r="3.7" fill="#646c64" stroke="#303530"/>`
  })));
  return { markup: `<g class="export-legend">${rows.join("")}</g>`, bottom: y };
}

function axisMarkup({
  xDomain,
  yDomain,
  xScale,
  yScale,
  xLabel,
  yLabel,
  margin,
  xTickFormatter
}: {
  xDomain: [number, number];
  yDomain: [number, number];
  xScale: ScaleMode;
  yScale: ScaleMode;
  xLabel: string;
  yLabel: string;
  margin: typeof BASE_MARGIN;
  xTickFormatter?: (value: number) => string;
}): string {
  const xRange: [number, number] = [margin.left, WIDTH - margin.right];
  const yRange: [number, number] = [HEIGHT - margin.bottom, margin.top];
  const majorX = ticks(xDomain, xRange, xScale).map((tick) => ({
    ...tick,
    label: xTickFormatter ? xTickFormatter(tick.value) : tick.label
  }));
  const majorY = ticks(yDomain, yRange, yScale);
  const minorX = minorTicks(xDomain, xRange, xScale);
  const minorY = minorTicks(yDomain, yRange, yScale);
  const bottom = HEIGHT - margin.bottom;
  const right = WIDTH - margin.right;
  return [
    `<rect class="plot-area" x="${margin.left}" y="${margin.top}" width="${right - margin.left}" height="${bottom - margin.top}"/>`,
    ...minorX.map((tick) => `<line class="minor-grid-line" x1="${tick.position}" x2="${tick.position}" y1="${margin.top}" y2="${bottom}"/>`),
    ...minorY.map((tick) => `<line class="minor-grid-line" x1="${margin.left}" x2="${right}" y1="${tick.position}" y2="${tick.position}"/>`),
    ...majorX.map((tick) => `<line class="grid-line" x1="${tick.position}" x2="${tick.position}" y1="${margin.top}" y2="${bottom}"/>`),
    ...majorY.map((tick) => `<line class="grid-line" x1="${margin.left}" x2="${right}" y1="${tick.position}" y2="${tick.position}"/>`),
    `<line class="axis-line" x1="${margin.left}" x2="${right}" y1="${bottom}" y2="${bottom}"/>`,
    `<line class="axis-line" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${bottom}"/>`,
    ...majorX.flatMap((tick) => [
      `<line class="axis-tick" x1="${tick.position}" x2="${tick.position}" y1="${bottom}" y2="${bottom + 5}"/>`,
      `<text class="axis-text" x="${tick.position}" y="${bottom + 21}" text-anchor="middle">${xml(tick.label)}</text>`
    ]),
    ...majorY.flatMap((tick) => [
      `<line class="axis-tick" x1="${margin.left - 5}" x2="${margin.left}" y1="${tick.position}" y2="${tick.position}"/>`,
      `<text class="axis-text" x="${margin.left - 10}" y="${tick.position + 3.5}" text-anchor="end">${xml(tick.label)}</text>`
    ]),
    `<text class="axis-title" x="${(margin.left + right) / 2}" y="${HEIGHT - 22}" text-anchor="middle">${scientificTextMarkup(xLabel)}</text>`,
    `<text class="axis-title" x="23" y="${(margin.top + bottom) / 2}" text-anchor="middle" transform="rotate(-90 23 ${(margin.top + bottom) / 2})">${scientificTextMarkup(yLabel)}</text>`
  ].join("");
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp((sorted.length - 1) * q, 0, sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

function principalAxis(points: Point[]) {
  const count = Math.max(points.length, 1);
  const cx = points.reduce((sum, point) => sum + point.x, 0) / count;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / count;
  if (points.length === 2) {
    const angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
    return { cx, cy, vx: Math.cos(angle), vy: Math.sin(angle), nx: -Math.sin(angle), ny: Math.cos(angle) };
  }
  let varX = 0;
  let varY = 0;
  let cov = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    varX += dx * dx;
    varY += dy * dy;
    cov += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * cov, varX - varY);
  return { cx, cy, vx: Math.cos(angle), vy: Math.sin(angle), nx: -Math.sin(angle), ny: Math.cos(angle) };
}

function projected(point: Point, axis: ReturnType<typeof principalAxis>) {
  const dx = point.x - axis.cx;
  const dy = point.y - axis.cy;
  return { point, t: dx * axis.vx + dy * axis.vy, n: dx * axis.nx + dy * axis.ny };
}

function robustCore(points: Point[]): Point[] {
  if (points.length <= 4) return points;
  let core = points;
  for (let pass = 0; pass < 2; pass += 1) {
    const axis = principalAxis(core);
    const candidates = points.map((point) => projected(point, axis));
    const center = median(candidates.map((item) => item.n));
    const residuals = candidates.map((item) => Math.abs(item.n - center));
    const mad = median(residuals) * 1.4826;
    const cutoff = Math.max(16, mad * 2.8, quantile(residuals, 0.78) * 1.35);
    const kept = candidates.filter((item) => Math.abs(item.n - center) <= cutoff).map((item) => item.point);
    core = kept.length >= Math.min(5, points.length) ? kept : candidates.sort((a, b) => Math.abs(a.n - center) - Math.abs(b.n - center)).slice(0, Math.ceil(points.length * 0.82)).map((item) => item.point);
  }
  return core;
}

function smoothClosedPath(points: Point[]): string {
  if (points.length < 3) return "";
  const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = midpoint(points.at(-1) as Point, points[0]);
  return [
    `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
    ...points.map((point, index) => {
      const end = midpoint(point, points[(index + 1) % points.length]);
      return `Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
    }),
    "Z"
  ].join(" ");
}

function ashbyEnvelope(points: Point[], limits: Box): { path: string; label: Point } | null {
  if (points.length < 2) return null;
  const core = robustCore(points);
  const axis = principalAxis(core);
  const values = core.map((point) => projected(point, axis));
  const normalCenter = median(values.map((item) => item.n));
  const normalResiduals = values.map((item) => Math.abs(item.n - normalCenter));
  let tMin = core.length <= 4 ? Math.min(...values.map((item) => item.t)) : quantile(values.map((item) => item.t), 0.03);
  let tMax = core.length <= 4 ? Math.max(...values.map((item) => item.t)) : quantile(values.map((item) => item.t), 0.97);
  if (tMax - tMin < 18) {
    const center = (tMin + tMax) / 2;
    tMin = center - 9;
    tMax = center + 9;
  }
  const spread = quantile(normalResiduals, core.length <= 4 ? 1 : 0.86);
  const halfWidth = clamp(spread * 1.35 + (core.length <= 4 ? 11 : 14), core.length <= 4 ? 12 : 17, 64);
  const endPadding = clamp(halfWidth * 0.64, 8, 28);
  tMin -= endPadding;
  tMax += endPadding;
  const centerT = (tMin + tMax) / 2;
  const halfLength = Math.max((tMax - tMin) / 2, 9);
  const endWidth = clamp(halfWidth * (core.length <= 4 ? 0.48 : 0.34), 7, halfWidth * 0.72);
  const upper: Point[] = [];
  const lower: Point[] = [];
  for (let index = 0; index <= 16; index += 1) {
    const normalized = (index / 16) * 2 - 1;
    const taper = Math.sqrt(Math.max(0, 1 - normalized * normalized));
    const localWidth = endWidth + (halfWidth - endWidth) * taper ** 0.78;
    const localT = centerT + normalized * halfLength;
    const pointAt = (normal: number): Point => ({
      x: clamp(axis.cx + axis.vx * localT + axis.nx * normal, limits.x0, limits.x1),
      y: clamp(axis.cy + axis.vy * localT + axis.ny * normal, limits.y0, limits.y1)
    });
    upper.push(pointAt(normalCenter + localWidth));
    lower.push(pointAt(normalCenter - localWidth));
  }
  const envelope = [...upper, ...lower.reverse()];
  const xs = envelope.map((point) => point.x);
  const ys = envelope.map((point) => point.y);
  return {
    path: smoothClosedPath(envelope),
    label: { x: clamp((Math.min(...xs) + Math.max(...xs)) / 2, limits.x0 + 30, limits.x1 - 30), y: clamp(Math.min(...ys) + 16, limits.y0 + 15, limits.y1 - 8) }
  };
}

function renderAshbyRegions(records: PlotRecord[], x: PropertyKey, y: PropertyKey, xDomain: [number, number], yDomain: [number, number], margin: typeof BASE_MARGIN): string {
  const xRange: [number, number] = [margin.left, WIDTH - margin.right];
  const yRange: [number, number] = [HEIGHT - margin.bottom, margin.top];
  const groups = new Map<string, Point[]>();
  for (const record of records) {
    const xValue = finite(record, x);
    const yValue = finite(record, y);
    if (xValue === null || yValue === null || xValue <= 0 || yValue <= 0) continue;
    const group = groups.get(record.material_family) ?? [];
    group.push({ x: scaleNumber(xValue, xDomain, xRange, "log"), y: scaleNumber(yValue, yDomain, yRange, "log") });
    groups.set(record.material_family, group);
  }
  const limits = { x0: margin.left + 4, y0: margin.top + 4, x1: WIDTH - margin.right - 4, y1: HEIGHT - margin.bottom - 4 };
  const regions: string[] = [];
  for (const family of FAMILY_ORDER) {
    const points = groups.get(family) ?? [];
    const envelope = ashbyEnvelope(points, limits);
    if (!envelope) continue;
    const color = FAMILY_COLORS[family] ?? { fill: "#979d95", stroke: "#60665f" };
    regions.push(`<path class="ashby-region" data-total-count="${points.length}" d="${envelope.path}" fill="${color.fill}" stroke="${color.stroke}"/>`);
    regions.push(`<text class="ashby-region-label" x="${envelope.label.x}" y="${envelope.label.y}" text-anchor="middle">${xml(FAMILY_LABELS[family] ?? family)}</text>`);
  }
  return `<g clip-path="url(#plot-clip)">${regions.join("")}</g>`;
}

function firstAuthor(authors: string): string {
  const cleaned = authors.replace(/\s+et\s+al\.?$/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) return cleaned.split(",")[0].trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  let start = Math.max(parts.length - 1, 0);
  while (start > 0 && AUTHOR_PARTICLES.has(parts[start - 1].toLowerCase().replace(/\.$/, ""))) start -= 1;
  return parts.slice(start).join(" ");
}

function metalLabel(record: PlotRecord): string | null {
  if (record.material_family !== "metal_comparator") return null;
  const label = stripMarkup(record.public_sample_label || record.sample_name || record.record_label);
  if (/\b(copper|cu)\b/i.test(label)) return "Cu";
  if (/\b(aluminum|aluminium|al)\b/i.test(label)) return "Al";
  if (/\b(silver|ag)\b/i.test(label)) return "Ag";
  if (/\b(gold|au)\b/i.test(label)) return "Au";
  if (/\b(nickel|ni)\b/i.test(label)) return "Ni";
  if (/\bsteel\b/i.test(label)) return "Steel";
  return label.length <= 18 ? label : "Metal";
}

function sourceLabel(record: PlotRecord): string {
  const author = firstAuthor(stripMarkup(record.publication_authors_short_verified));
  const year = record.publication_year_verified;
  if (author && year) return `${author} et al. ${year}`;
  const fallback = stripMarkup(record.publication_title_verified || record.public_sample_label || record.record_label);
  return fallback.length > 38 ? `${fallback.slice(0, 35)}...` : fallback;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function overlapArea(a: Box, b: Box): number {
  const width = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const height = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return width * height;
}

function segmentBounds(start: Point, end: Point, padding = 1): Box {
  return {
    x0: Math.min(start.x, end.x) - padding,
    y0: Math.min(start.y, end.y) - padding,
    x1: Math.max(start.x, end.x) + padding,
    y1: Math.max(start.y, end.y) + padding
  };
}

function renderCallouts(records: PlotRecord[], points: Map<string, Point>, valueKey: PropertyKey, margin: typeof BASE_MARGIN): string {
  const seenMetals = new Set<string>();
  const metals = records
    .filter((record) => record.material_family === "metal_comparator")
    .filter((record) => {
      const label = metalLabel(record) ?? "Metal";
      if (seenMetals.has(label)) return false;
      seenMetals.add(label);
      return true;
    });
  const sources = records
    .filter((record) => record.material_family !== "metal_comparator")
    .slice()
    .sort((a, b) => (finite(b, valueKey) ?? -Infinity) - (finite(a, valueKey) ?? -Infinity))
    .filter((record, index, all) => {
      const doi = (record.doi_verified || record.doi_raw || record.record_id).toLowerCase();
      return all.findIndex((candidate) => (candidate.doi_verified || candidate.doi_raw || candidate.record_id).toLowerCase() === doi) === index;
    })
    .slice(0, 3);
  const occupied: Box[] = [];
  const markerBoxes = new Map(
    Array.from(points, ([recordId, point]) => [
      recordId,
      { x0: point.x - 8, y0: point.y - 8, x1: point.x + 8, y1: point.y + 8 }
    ])
  );
  const output: string[] = [];
  for (const record of [...sources, ...metals]) {
    const point = points.get(record.record_id);
    if (!point) continue;
    const text = metalLabel(record) ?? sourceLabel(record);
    const width = clamp(text.length * 5.7 + 4, 32, 210);
    const height = 16;
    const rawCandidates: Array<{ x0: number; y0: number }> = [];
    for (let lane = 0; lane < 12; lane += 1) {
      const vertical = 24 + lane * 18;
      const horizontal = 12 + lane * 20;
      rawCandidates.push(
        { x0: point.x + 12, y0: point.y - vertical },
        { x0: point.x - width - 12, y0: point.y - vertical },
        { x0: point.x + 12, y0: point.y + vertical - height },
        { x0: point.x - width - 12, y0: point.y + vertical - height },
        { x0: point.x - width / 2, y0: point.y - vertical - 8 },
        { x0: point.x - width / 2, y0: point.y + vertical },
        { x0: point.x + horizontal, y0: point.y - height / 2 },
        { x0: point.x - width - horizontal, y0: point.y - height / 2 }
      );
    }
    const candidates = rawCandidates.map((candidate) => {
      const x0 = clamp(candidate.x0, margin.left + 4, WIDTH - margin.right - width - 4);
      const y0 = clamp(candidate.y0, margin.top + 4, HEIGHT - margin.bottom - height - 4);
      return { x0, y0, x1: x0 + width, y1: y0 + height };
    }).filter((candidate, index, all) => (
      all.findIndex((other) => other.x0 === candidate.x0 && other.y0 === candidate.y0) === index
    ));
    const labelMarkers = Array.from(markerBoxes.values());
    const otherMarkers = Array.from(markerBoxes.entries())
      .filter(([recordId]) => recordId !== record.record_id)
      .map(([, box]) => box);
    const score = (box: Box, preference: number): number => {
      const leader = {
        x: clamp(point.x, box.x0, box.x1),
        y: clamp(point.y, box.y0, box.y1)
      };
      const leaderBounds = segmentBounds(point, leader);
      const labelCollisions = occupied.filter((existing) => overlaps(box, existing)).length;
      const labelOverlap = occupied.reduce((total, existing) => total + overlapArea(box, existing), 0);
      const markerOverlap = labelMarkers.reduce((total, marker) => total + overlapArea(box, marker), 0);
      const crossedLabels = occupied.filter((existing) => overlaps(leaderBounds, existing)).length;
      const crossedMarkers = otherMarkers.filter((marker) => overlaps(leaderBounds, marker)).length;
      const distance = Math.hypot(leader.x - point.x, leader.y - point.y);
      const edgePenalty = Number(box.x0 <= margin.left + 4.5)
        + Number(box.x1 >= WIDTH - margin.right - 4.5)
        + Number(box.y0 <= margin.top + 4.5)
        + Number(box.y1 >= HEIGHT - margin.bottom - 4.5);
      return labelCollisions * 1_000_000_000_000
        + labelOverlap * 1_000_000
        + markerOverlap * 100_000
        + crossedLabels * 50_000
        + crossedMarkers * 2_000
        + edgePenalty * 500
        + distance
        + preference;
    };
    const box = candidates
      .map((candidate, index) => ({ candidate, score: score(candidate, index) }))
      .sort((a, b) => a.score - b.score)[0].candidate;
    occupied.push(box);
    const leaderX = clamp(point.x, box.x0, box.x1);
    const leaderY = clamp(point.y, box.y0, box.y1);
    output.push(`<line class="label-leader" x1="${point.x}" y1="${point.y}" x2="${leaderX}" y2="${leaderY}"/>`);
    output.push(`<text class="point-label" x="${box.x0}" y="${box.y0 + 11}" text-anchor="start">${xml(text)}</text>`);
  }
  return `<g>${output.join("")}</g>`;
}

function documentShell(
  body: string,
  title: string,
  margin: typeof BASE_MARGIN,
  interactive: boolean,
  metadata: SvgFigureOptions["documentMetadata"]
): string {
  const watermark = interactive
    ? `<text class="plot-watermark" x="${WIDTH - margin.right - 4}" y="${HEIGHT - margin.bottom - 12}" text-anchor="end" fill="#69706a" opacity="0.22" font-family="Arial,Helvetica,sans-serif" font-size="10.5" font-weight="700">Carbon Property Tables · cite original sources</text>`
    : "";
  const metadataPayload = JSON.stringify({
    producer: "Carbon Property Tables",
    release_id: metadata.releaseId,
    source_hash: metadata.sourceHash,
    comparability_model: metadata.comparabilityModel,
    comparability_disclosure: metadata.comparabilityDisclosure,
    citation_policy: "Cite original sources and Carbon Property Tables"
  });
  return `${interactive ? "" : '<?xml version="1.0" encoding="UTF-8"?>\n'}<svg class="plot-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><title>${xml(title)}</title><desc>${xml(metadata.comparabilityDisclosure)} Release ${xml(metadata.releaseId)}. Cite the supplied original sources and Carbon Property Tables.</desc><metadata>${xml(metadataPayload)}</metadata><defs><style>${FIGURE_SVG_CSS}</style><clipPath id="plot-clip"><rect x="${margin.left}" y="${margin.top}" width="${WIDTH - margin.right - margin.left}" height="${HEIGHT - margin.bottom - margin.top}"/></clipPath></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>${body}${watermark}</svg>`;
}

function renderScatter(options: SvgFigureOptions): string {
  const xMeta = PROPERTY_BY_KEY.get(options.x);
  const yMeta = PROPERTY_BY_KEY.get(options.y);
  if (!xMeta || !yMeta) throw new Error("Unknown property metadata.");
  const legend = renderLegend(options.records, options.comparabilityGrades);
  const margin = { ...BASE_MARGIN, top: Math.max(BASE_MARGIN.top, legend.bottom + 14) };
  const xValues = options.records.map((record) => finite(record, options.x)).filter((value): value is number => value !== null);
  const yValues = options.records.map((record) => finite(record, options.y)).filter((value): value is number => value !== null);
  if (options.temporary) {
    xValues.push(options.temporary.x);
    yValues.push(options.temporary.y);
  }
  const xDomain = extent(xValues, options.xScale);
  const yDomain = extent(yValues, options.yScale);
  const xRange: [number, number] = [margin.left, WIDTH - margin.right];
  const yRange: [number, number] = [HEIGHT - margin.bottom, margin.top];
  const points = new Map<string, Point>();
  for (const record of options.records) {
    const xValue = finite(record, options.x);
    const yValue = finite(record, options.y);
    if (xValue === null || yValue === null || (options.xScale === "log" && xValue <= 0) || (options.yScale === "log" && yValue <= 0)) continue;
    points.set(record.record_id, {
      x: scaleNumber(xValue, xDomain, xRange, options.xScale),
      y: scaleNumber(yValue, yDomain, yRange, options.yScale)
    });
  }
  const title = `${options.kind === "ashby" ? "Ashby plot: " : ""}${yMeta.label} vs ${xMeta.label}`;
  const regions = options.kind === "ashby" ? renderAshbyRegions(options.records, options.x, options.y, xDomain, yDomain, margin) : "";
  const markers = options.records.map((record) => {
    const point = points.get(record.record_id);
    return point ? pointMarkup(record, point.x, point.y, options) : "";
  }).join("");
  const temporary = options.temporary && (options.xScale === "linear" || options.temporary.x > 0) && (options.yScale === "linear" || options.temporary.y > 0)
    ? (() => {
        const x = scaleNumber(options.temporary?.x ?? 0, xDomain, xRange, options.xScale);
        const y = scaleNumber(options.temporary?.y ?? 0, yDomain, yRange, options.yScale);
        return `${starGeometry(x, y)}<text class="temporary-point-label" x="${clamp(x + 11, margin.left + 4, WIDTH - margin.right - 92)}" y="${clamp(y - 10, margin.top + 12, HEIGHT - margin.bottom - 5)}">${xml(options.temporary?.label || "User input")}</text>`;
      })()
    : "";
  const body = [
    legend.markup,
    axisMarkup({ xDomain, yDomain, xScale: options.xScale, yScale: options.yScale, xLabel: `${xMeta.label} (${xMeta.displayUnit})`, yLabel: `${yMeta.label} (${yMeta.displayUnit})`, margin }),
    regions,
    `<g clip-path="url(#plot-clip)">${markers}${temporary}</g>`,
    renderCallouts(options.records, points, options.y, margin)
  ].join("");
  return documentShell(body, title, margin, options.interactive, options.documentMetadata);
}

function renderRanked(options: SvgFigureOptions): string {
  const yMeta = PROPERTY_BY_KEY.get(options.y);
  if (!yMeta) throw new Error("Unknown property metadata.");
  const plotRecords = options.records
    .filter((record) => {
      const value = finite(record, options.y);
      return value !== null && (options.yScale === "linear" || value > 0);
    })
    .sort((a, b) => (finite(b, options.y) ?? -Infinity) - (finite(a, options.y) ?? -Infinity))
    .slice(0, 18);
  const legend = renderLegend(plotRecords, options.comparabilityGrades);
  const margin = { ...BASE_MARGIN, top: Math.max(128, legend.bottom + 36), left: 214, right: 68 };
  const values = [
    ...plotRecords.map((record) => finite(record, options.y) as number),
    ...options.referenceLines.map((line) => line.value),
    ...(options.temporary ? [options.temporary.y] : [])
  ];
  const xDomain = extent(values, options.yScale, true);
  const xRange: [number, number] = [margin.left, WIDTH - margin.right];
  const bottom = HEIGHT - margin.bottom;
  const rowStep = (bottom - margin.top) / Math.max(plotRecords.length, 1);
  const axis = axisMarkup({
    xDomain,
    yDomain: [0, 1],
    xScale: options.yScale,
    yScale: "linear",
    xLabel: `${yMeta.label} (${yMeta.displayUnit})`,
    yLabel: "",
    margin
  }).replace(/<text class="axis-text" x="204"[\s\S]*?<text class="axis-title" x="23"[\s\S]*?<\/text>/g, "");
  const rows = plotRecords.map((record, index) => {
    const value = finite(record, options.y) as number;
    const y = margin.top + rowStep * (index + 0.5);
    const x = scaleNumber(value, xDomain, xRange, options.yScale);
    const baseline = options.yScale === "log" ? xRange[0] : scaleNumber(0, xDomain, xRange, options.yScale);
    const point = pointMarkup(record, x, y, options);
    const label = sourceLabel(record);
    return `<line class="rank-row-line" x1="${margin.left}" x2="${WIDTH - margin.right}" y1="${y}" y2="${y}"/><line class="rank-value-line" x1="${baseline}" x2="${x}" y1="${y}" y2="${y}"/><text class="rank-label" x="${margin.left - 12}" y="${y + 3.5}" text-anchor="end">${xml(label)}</text>${point}<text class="rank-value-text" x="${clamp(x + 10, margin.left + 8, WIDTH - margin.right - 42)}" y="${y + 3.5}">${xml(formatNumber(value))}</text>`;
  }).join("");
  const references = options.referenceLines
    .filter((line) => Number.isFinite(line.value) && (options.yScale === "linear" || line.value > 0))
    .map((line, index) => {
      const x = scaleNumber(line.value, xDomain, xRange, options.yScale);
      const lane = index % 3;
      const tagY = margin.top - 53 + lane * 18;
      const text = `${line.label} ${formatNumber(line.value)}`;
      const width = clamp(text.length * 6 + 14, 52, 126);
      const boxX = clamp(x - width / 2, margin.left, WIDTH - margin.right - width);
      return `<line class="rank-reference-line ${xml(line.className || "")}" x1="${x}" x2="${x}" y1="${margin.top - 5}" y2="${bottom}"/><line class="rank-reference-leader ${xml(line.className || "")}" x1="${x}" x2="${clamp(x, boxX, boxX + width)}" y1="${margin.top - 5}" y2="${tagY + 14}"/><rect class="rank-reference-tag ${xml(line.className || "")}" x="${boxX}" y="${tagY}" width="${width}" height="16" rx="2"/><text class="rank-reference-label ${xml(line.className || "")}" x="${boxX + width / 2}" y="${tagY + 11.5}" text-anchor="middle">${xml(text)}</text>`;
    }).join("");
  const temporary = options.temporary && Number.isFinite(options.temporary.y) && (options.yScale === "linear" || options.temporary.y > 0)
    ? (() => {
        const x = scaleNumber(options.temporary?.y ?? 0, xDomain, xRange, options.yScale);
        return `<line class="temporary-rank-line" x1="${x}" x2="${x}" y1="${margin.top}" y2="${bottom}"/><text class="temporary-point-label" x="${clamp(x + 5, margin.left + 4, WIDTH - margin.right - 82)}" y="${margin.top + 13}">${xml(options.temporary?.label || "User input")}</text>`;
      })()
    : "";
  return documentShell(`${legend.markup}${axis}${references}${rows}${temporary}`, `Highest reported values: ${yMeta.label}`, margin, options.interactive, options.documentMetadata);
}

function renderTrend(options: SvgFigureOptions): string {
  const yMeta = PROPERTY_BY_KEY.get(options.y);
  if (!yMeta) throw new Error("Unknown property metadata.");
  const records = options.records.filter((record) => record.publication_year_verified !== null && finite(record, options.y) !== null);
  const legend = renderLegend(records, options.comparabilityGrades);
  const margin = { ...BASE_MARGIN, top: Math.max(BASE_MARGIN.top, legend.bottom + 14) };
  const years = records.map((record) => record.publication_year_verified as number);
  const yearMinimum = years.length ? Math.max(1991, Math.floor(Math.min(...years) / 5) * 5) : 1991;
  const yearMaximumRaw = years.length ? Math.ceil(Math.max(...years) / 5) * 5 : new Date().getFullYear();
  const xDomain: [number, number] = [yearMinimum, Math.max(yearMinimum + 5, yearMaximumRaw)];
  const yDomain = extent(records.map((record) => finite(record, options.y) as number), options.yScale);
  const xRange: [number, number] = [margin.left, WIDTH - margin.right];
  const yRange: [number, number] = [HEIGHT - margin.bottom, margin.top];
  const points = new Map<string, Point>();
  records.forEach((record) => points.set(record.record_id, {
    x: scaleNumber(record.publication_year_verified as number, xDomain, xRange, "linear"),
    y: scaleNumber(finite(record, options.y) as number, yDomain, yRange, options.yScale)
  }));
  const body = [
    legend.markup,
    axisMarkup({
      xDomain,
      yDomain,
      xScale: "linear",
      yScale: options.yScale,
      xLabel: "Publication year",
      yLabel: `${yMeta.label} (${yMeta.displayUnit})`,
      margin,
      xTickFormatter: (value) => String(Math.round(value))
    }),
    `<g clip-path="url(#plot-clip)">${records.map((record) => {
      const point = points.get(record.record_id) as Point;
      return pointMarkup(record, point.x, point.y, options);
    }).join("")}</g>`,
    renderCallouts(records, points, options.y, margin)
  ].join("");
  return documentShell(body, `${yMeta.label} by publication year`, margin, options.interactive, options.documentMetadata);
}

export function renderSvgFigure(options: SvgFigureOptions): string {
  if (options.kind === "ranked") return renderRanked(options);
  if (options.kind === "trend") return renderTrend(options);
  return renderScatter(options);
}
