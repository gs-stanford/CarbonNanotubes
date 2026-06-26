"use client";

import { ExportLegend } from "@/components/ExportLegend";
import type { PlotRecord, PropertyKey, PropertyMeta, ScaleMode } from "@/lib/data";

type ScatterPlotProps = {
  records: PlotRecord[];
  xKey: PropertyKey;
  yKey: PropertyKey;
  xMeta: PropertyMeta;
  yMeta: PropertyMeta;
  xScale: ScaleMode;
  yScale: ScaleMode;
  variant?: "scatter" | "ashby";
  selectedId: string | null;
  highlightedIds?: Set<string>;
  onSelect: (record: PlotRecord) => void;
};

type Tick = {
  value: number;
  position: number;
  label: string;
};

type Box = { x0: number; y0: number; x1: number; y1: number };

type LabelPlacement = {
  record: PlotRecord;
  x: number;
  y: number;
  textX: number;
  textY: number;
  textAnchor: "start" | "middle" | "end";
  leaderX: number;
  leaderY: number;
  box: Box;
  text: string;
  kind: "benchmark" | "source";
};

type AshbyRegion = {
  key: string;
  label: string;
  className: string;
  path: string;
  labelX: number;
  labelY: number;
  bounds: Box;
  count: number;
  coreCount: number;
};

type RegionLabelPlacement = {
  region: AshbyRegion;
  x: number;
  y: number;
  box: Box;
};

const WIDTH = 920;
const HEIGHT = 560;
const MARGIN = { top: 42, right: 34, bottom: 74, left: 92 };
const LINEAR_TICK_TARGET = 6;
const MIN_ASHBY_REGION_POINTS = 2;
const MAX_SOURCE_LABELS = 3;
const MAX_BENCHMARK_LABELS = 4;
const MAX_TOTAL_LABELS = 7;
const MAX_LABEL_LEADER_LENGTH = 92;

type MarkerShape = "circle" | "open-circle" | "square" | "diamond" | "triangle" | "down-triangle" | "hexagon";

function positiveValues(values: number[], scale: ScaleMode): number[] {
  return values.filter((value) => Number.isFinite(value) && (scale === "linear" || value > 0));
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exponent);
  const fraction = rawStep / base;
  if (fraction <= 1) return base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 2.5) return 2.5 * base;
  if (fraction <= 5) return 5 * base;
  return 10 * base;
}

function niceLinearDomain(min: number, max: number, forceZero: boolean): [number, number] {
  const span = Math.max(max - min, Math.abs(max), 1);
  const step = niceStep(span / (LINEAR_TICK_TARGET - 1));
  const lower = forceZero ? 0 : Math.floor(min / step) * step;
  let upper = Math.ceil(max / step) * step;
  if (upper <= lower) upper = lower + step * (LINEAR_TICK_TARGET - 1);
  return [lower, upper];
}

function extent(values: number[], scale: ScaleMode): [number, number] {
  const valid = positiveValues(values, scale);
  if (!valid.length) return [1, 10];
  let min = Math.min(...valid);
  let max = Math.max(...valid);
  const allNonNegative = valid.every((value) => value >= 0);
  if (min === max) {
    if (scale === "log") {
      min /= 3;
      max *= 3;
    } else {
      const delta = Math.max(Math.abs(max) * 0.15, 1);
      min = allNonNegative ? 0 : min - delta;
      max += delta;
    }
  }
  if (scale === "log") {
    min = Math.pow(10, Math.floor(Math.log10(min)));
    max = Math.pow(10, Math.ceil(Math.log10(max)));
  } else {
    const pad = Math.max((max - min) * 0.06, Math.abs(max) * 0.02, 0.1);
    return niceLinearDomain(allNonNegative ? 0 : min - pad, max + pad, allNonNegative);
  }
  return [min, max];
}

function scaleNumber(value: number, domain: [number, number], range: [number, number], mode: ScaleMode): number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const t =
    mode === "log"
      ? (Math.log10(value) - Math.log10(d0)) / (Math.log10(d1) - Math.log10(d0))
      : (value - d0) / (d1 - d0);
  return r0 + t * (r1 - r0);
}

function formatTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) return rounded.toLocaleString("en-US");
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (Math.abs(value) >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toLocaleString("en-US", { maximumSignificantDigits: 2 });
}

function ticks(domain: [number, number], range: [number, number], mode: ScaleMode): Tick[] {
  if (mode === "log") {
    const start = Math.ceil(Math.log10(domain[0]));
    const end = Math.floor(Math.log10(domain[1]));
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
      const value = Math.pow(10, start + index);
      return {
        value,
        position: scaleNumber(value, domain, range, mode),
        label: formatTick(value)
      };
    });
  }

  const step = niceStep((domain[1] - domain[0]) / (LINEAR_TICK_TARGET - 1));
  const start = Math.ceil(domain[0] / step) * step;
  const values: number[] = [];
  for (let value = start; value <= domain[1] + step * 0.5; value += step) {
    values.push(Number(value.toPrecision(12)));
  }
  return values.map((value) => {
    return {
      value,
      position: scaleNumber(value, domain, range, mode),
      label: formatTick(value)
    };
  });
}

function minorLogTicks(domain: [number, number], range: [number, number], mode: ScaleMode): Tick[] {
  if (mode !== "log") return [];
  const start = Math.floor(Math.log10(domain[0]));
  const end = Math.ceil(Math.log10(domain[1]));
  const values: Tick[] = [];
  for (let exponent = start; exponent <= end; exponent += 1) {
    const decade = Math.pow(10, exponent);
    for (let multiple = 2; multiple < 10; multiple += 1) {
      const value = multiple * decade;
      if (value > domain[0] && value < domain[1]) {
        values.push({
          value,
          position: scaleNumber(value, domain, range, mode),
          label: ""
        });
      }
    }
  }
  return values;
}

function formShape(record: PlotRecord): MarkerShape {
  if (record.form_factor === "fiber_yarn") return "circle";
  if (record.form_factor === "sheet_mat_film") return "down-triangle";
  if (record.form_factor === "buckypaper") return "square";
  if (record.form_factor === "foam_aerogel") return "open-circle";
  if (record.form_factor === "forest_array") return "triangle";
  if (record.form_factor === "individual_nanotube_or_bundle") return "diamond";
  if (record.form_factor === "bulk") return "hexagon";
  return "circle";
}

function shapeClass(shape: MarkerShape): string {
  return `point-shape-${shape}`;
}

function materialClass(record: PlotRecord): string {
  if (record.material_family === "CNT_or_CNT_hybrid") return "point-material-cnt";
  if (record.material_family === "CNT_metal_composite") return "point-material-cnt-metal";
  if (record.material_family === "graphene_or_GO_fiber") return "point-material-graphene";
  if (record.material_family === "carbon_fiber_comparator") return "point-material-carbon-fiber";
  if (record.material_family === "other_carbon_comparator") return "point-material-other-carbon";
  if (record.material_family === "polymer_fiber_comparator") return "point-material-polymer";
  if (record.material_family === "metal_comparator") return "point-material-metal";
  if (record.material_family === "ceramic_or_glass_comparator") return "point-material-ceramic";
  return "point-material-unknown";
}

function ashbyRegionClass(materialFamily: string): string {
  if (materialFamily === "CNT_or_CNT_hybrid") return "ashby-region-cnt";
  if (materialFamily === "CNT_metal_composite") return "ashby-region-cnt-metal";
  if (materialFamily === "graphene_or_GO_fiber") return "ashby-region-graphene";
  if (materialFamily === "carbon_fiber_comparator") return "ashby-region-carbon-fiber";
  if (materialFamily === "other_carbon_comparator") return "ashby-region-other-carbon";
  if (materialFamily === "polymer_fiber_comparator") return "ashby-region-polymer";
  if (materialFamily === "metal_comparator") return "ashby-region-metal";
  if (materialFamily === "ceramic_or_glass_comparator") return "ashby-region-ceramic";
  return "ashby-region-unknown";
}

function materialFamilyLabel(materialFamily: string): string {
  if (materialFamily === "CNT_or_CNT_hybrid") return "CNT";
  if (materialFamily === "CNT_metal_composite") return "CNT-metal composite";
  if (materialFamily === "graphene_or_GO_fiber") return "Graphene / graphite";
  if (materialFamily === "carbon_fiber_comparator") return "Carbon fiber";
  if (materialFamily === "other_carbon_comparator") return "Other carbon";
  if (materialFamily === "polymer_fiber_comparator") return "Polymer";
  if (materialFamily === "metal_comparator") return "Metal";
  if (materialFamily === "ceramic_or_glass_comparator") return "Ceramic / glass";
  return "Other";
}

const METAL_BENCHMARK_ORDER = new Map([
  ["Cu", 0],
  ["Al", 1],
  ["Ag", 2],
  ["Au", 3],
  ["Ni", 4],
  ["Fe", 5],
  ["Steel", 6],
  ["Zn", 7]
]);

function metalBenchmarkLabel(record: PlotRecord): string | null {
  if (record.material_family !== "metal_comparator") return null;
  const raw = stripMarkup(record.public_sample_label ?? record.sample_name ?? record.record_label);
  if (!raw) return "Metal";
  if (/\b(copper|cu)\b/i.test(raw)) return "Cu";
  if (/\b(aluminum|aluminium|al)\b/i.test(raw)) return "Al";
  if (/\b(silver|ag)\b/i.test(raw)) return "Ag";
  if (/\b(gold|au)\b/i.test(raw)) return "Au";
  if (/\b(nickel|ni)\b/i.test(raw)) return "Ni";
  if (/\b(iron|fe)\b/i.test(raw)) return "Fe";
  if (/\bsteel\b/i.test(raw)) return "Steel";
  if (/\b(zinc|zn)\b/i.test(raw)) return "Zn";
  return "Metal";
}

function metricValue(record: PlotRecord, key: PropertyKey): number {
  const value = record.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function covarianceStats(points: Array<{ x: number; y: number }>) {
  const count = Math.max(points.length, 1);
  const cx = points.reduce((sum, point) => sum + point.x, 0) / count;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / count;
  if (points.length <= 1) {
    return { cx, cy, varX: 0, varY: 0, covXY: 0 };
  }
  const denom = Math.max(points.length - 1, 1);
  let varX = 0;
  let varY = 0;
  let covXY = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    varX += dx * dx;
    varY += dy * dy;
    covXY += dx * dy;
  }
  return { cx, cy, varX: varX / denom, varY: varY / denom, covXY: covXY / denom };
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp((sorted.length - 1) * q, 0, sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function principalAxis(points: Array<{ x: number; y: number }>) {
  const stats = covarianceStats(points);
  let angle = 0;
  if (points.length === 2) {
    angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
  } else {
    angle = 0.5 * Math.atan2(2 * stats.covXY, stats.varX - stats.varY);
  }
  let vx = Math.cos(angle);
  let vy = Math.sin(angle);
  if (!Number.isFinite(vx) || !Number.isFinite(vy) || Math.hypot(vx, vy) < 0.1) {
    vx = 1;
    vy = 0;
  }
  return {
    cx: stats.cx,
    cy: stats.cy,
    vx,
    vy,
    nx: -vy,
    ny: vx
  };
}

function projectToAxis(point: { x: number; y: number }, axis: ReturnType<typeof principalAxis>) {
  const dx = point.x - axis.cx;
  const dy = point.y - axis.cy;
  return {
    t: dx * axis.vx + dy * axis.vy,
    n: dx * axis.nx + dy * axis.ny
  };
}

function coreByNormalResidual(points: Array<{ x: number; y: number }>, axis: ReturnType<typeof principalAxis>): Array<{ x: number; y: number }> {
  const projected = points.map((point) => ({ point, ...projectToAxis(point, axis) }));
  const centerNormal = median(projected.map((item) => item.n));
  const residuals = projected.map((item) => Math.abs(item.n - centerNormal));
  const targetCount = clamp(Math.ceil(points.length * 0.82), Math.min(points.length, 6), points.length);
  const residualMAD = median(residuals) * 1.4826;
  const residualCutoff = Math.max(18, residualMAD * 2.6, quantile(residuals, 0.76) * 1.45);
  const sorted = projected
    .map((item, index) => ({ ...item, residual: residuals[index] }))
    .sort((a, b) => a.residual - b.residual);
  const trimmed = sorted.filter((item) => item.residual <= residualCutoff).map((item) => item.point);
  if (trimmed.length >= Math.min(points.length, 5)) return trimmed;
  return sorted.slice(0, targetCount).map((item) => item.point);
}

function robustCore(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length <= 4) return points;
  let core = coreByNormalResidual(points, principalAxis(points));
  core = coreByNormalResidual(points, principalAxis(core));
  return core;
}

function boundsFor(points: Array<{ x: number; y: number }>): Box {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys)
  };
}

function smoothClosedPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 3) return "";
  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  });
  const start = midpoint(points[points.length - 1], points[0]);
  const commands = [`M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const end = midpoint(current, next);
    commands.push(`Q ${current.x.toFixed(1)} ${current.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function trendBandFor(
  points: Array<{ x: number; y: number }>,
  limits: { left: number; right: number; top: number; bottom: number }
): { path: string; bounds: Box; labelX: number; labelY: number } | null {
  if (points.length < MIN_ASHBY_REGION_POINTS) return null;
  const core = robustCore(points);
  if (core.length < MIN_ASHBY_REGION_POINTS) return null;

  const axis = principalAxis(core);
  const projected = core.map((point) => {
    return projectToAxis(point, axis);
  });
  const tValues = projected.map((point) => point.t);
  const nValues = projected.map((point) => point.n);
  let tMin = core.length <= 4 ? Math.min(...tValues) : quantile(tValues, 0.02);
  let tMax = core.length <= 4 ? Math.max(...tValues) : quantile(tValues, 0.98);
  if (tMax - tMin < 16) {
    const center = (tMin + tMax) / 2;
    tMin = center - 8;
    tMax = center + 8;
  }
  const centerNormal = median(nValues);
  const normalResiduals = nValues.map((value) => Math.abs(value - centerNormal));
  const robustNormalSpread = quantile(normalResiduals, core.length <= 4 ? 1 : 0.86);
  const halfWidth = clamp(robustNormalSpread * 1.35 + (core.length <= 4 ? 12 : 15), core.length <= 4 ? 13 : 18, core.length <= 4 ? 30 : 66);
  const endPad = clamp(halfWidth * 0.62, 8, 30);
  tMin -= endPad;
  tMax += endPad;

  const tCenter = (tMin + tMax) / 2;
  const halfLength = Math.max((tMax - tMin) / 2, 8);
  const endWidth = clamp(halfWidth * (core.length <= 4 ? 0.46 : 0.32), 7, halfWidth * 0.7);
  const edgeSteps = 14;
  const upper: Array<{ x: number; y: number }> = [];
  const lower: Array<{ x: number; y: number }> = [];
  for (let index = 0; index <= edgeSteps; index += 1) {
    const progress = index / edgeSteps;
    const normalized = progress * 2 - 1;
    const taper = Math.sqrt(Math.max(0, 1 - normalized * normalized));
    const localWidth = endWidth + (halfWidth - endWidth) * Math.pow(taper, 0.78);
    const localT = tCenter + normalized * halfLength;
    upper.push({
      x: clamp(axis.cx + axis.vx * localT + axis.nx * (centerNormal + localWidth), limits.left, limits.right),
      y: clamp(axis.cy + axis.vy * localT + axis.ny * (centerNormal + localWidth), limits.top, limits.bottom)
    });
    lower.push({
      x: clamp(axis.cx + axis.vx * localT + axis.nx * (centerNormal - localWidth), limits.left, limits.right),
      y: clamp(axis.cy + axis.vy * localT + axis.ny * (centerNormal - localWidth), limits.top, limits.bottom)
    });
  }
  const envelopePoints = upper.concat(lower.reverse());
  const path = smoothClosedPath(envelopePoints);
  if (!path) return null;
  const bounds = boundsFor(envelopePoints);
  return {
    path,
    bounds,
    labelX: clamp((bounds.x0 + bounds.x1) / 2, limits.left + 28, limits.right - 28),
    labelY: clamp(bounds.y0 + 15, limits.top + 15, limits.bottom - 8)
  };
}

function ashbyRegions({
  records,
  xKey,
  yKey,
  xDomain,
  yDomain,
  xRange,
  yRange,
  xScale,
  yScale
}: {
  records: PlotRecord[];
  xKey: PropertyKey;
  yKey: PropertyKey;
  xDomain: [number, number];
  yDomain: [number, number];
  xRange: [number, number];
  yRange: [number, number];
  xScale: ScaleMode;
  yScale: ScaleMode;
}): AshbyRegion[] {
  const groups = new Map<string, Array<{ x: number; y: number }>>();
  for (const record of records) {
    const xValue = record.values[xKey];
    const yValue = record.values[yKey];
    if (typeof xValue !== "number" || typeof yValue !== "number") continue;
    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) continue;
    const group = groups.get(record.material_family) ?? [];
    group.push({
      x: scaleNumber(xValue, xDomain, xRange, xScale),
      y: scaleNumber(yValue, yDomain, yRange, yScale)
    });
    groups.set(record.material_family, group);
  }

  const plotLeft = MARGIN.left + 4;
  const plotRight = WIDTH - MARGIN.right - 4;
  const plotTop = MARGIN.top + 4;
  const plotBottom = HEIGHT - MARGIN.bottom - 4;
  const plotLimits = { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom };

  return Array.from(groups.entries())
    .map(([key, points]) => {
      if (points.length < MIN_ASHBY_REGION_POINTS) return null;
      const region = trendBandFor(points, plotLimits);
      if (!region) return null;
      const coreCount = robustCore(points).length;
      return {
        key,
        label: materialFamilyLabel(key),
        className: ashbyRegionClass(key),
        path: region.path,
        labelX: region.labelX,
        labelY: region.labelY,
        bounds: region.bounds,
        count: points.length,
        coreCount
      };
    })
    .filter((region): region is AshbyRegion => Boolean(region))
    .sort((a, b) => (b.bounds.x1 - b.bounds.x0) * (b.bounds.y1 - b.bounds.y0) - (a.bounds.x1 - a.bounds.x0) * (a.bounds.y1 - a.bounds.y0));
}

function pointRadius(record: PlotRecord): number {
  if (record.public_release_tier === "peer_reviewed_research") return 4.2;
  if (record.public_release_tier === "peer_reviewed_contextual_comparator") return 3.9;
  return 3.6;
}

function boxesOverlap(a: LabelPlacement["box"], b: LabelPlacement["box"]): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function placeRegionLabels(regions: AshbyRegion[], occupiedBoxes: Box[] = []): RegionLabelPlacement[] {
  const placements: RegionLabelPlacement[] = [];
  for (const region of regions) {
    const width = Math.min(156, Math.max(48, region.label.length * 5.4 + 9));
    const height = 17;
    const candidates = [
      { x0: region.labelX - width / 2, y0: region.labelY - 12 },
      { x0: region.labelX - width / 2, y0: (region.bounds.y0 + region.bounds.y1) / 2 - height / 2 },
      { x0: region.bounds.x1 - width - 8, y0: region.bounds.y0 + 8 },
      { x0: region.bounds.x0 + 8, y0: region.bounds.y0 + 8 },
      { x0: region.labelX - width / 2, y0: region.bounds.y1 - height - 8 },
      { x0: region.bounds.x1 + 6, y0: (region.bounds.y0 + region.bounds.y1) / 2 - height / 2 },
      { x0: region.bounds.x0 - width - 6, y0: (region.bounds.y0 + region.bounds.y1) / 2 - height / 2 }
    ].map((candidate) => {
      const x0 = clamp(candidate.x0, MARGIN.left + 4, WIDTH - MARGIN.right - width - 4);
      const y0 = clamp(candidate.y0, MARGIN.top + 4, HEIGHT - MARGIN.bottom - height - 4);
      return {
        x0,
        y0,
        x1: x0 + width,
        y1: y0 + height
      };
    });
    const box =
      candidates.find(
        (candidate) =>
          placements.every((placement) => !boxesOverlap(candidate, placement.box)) &&
          occupiedBoxes.every((occupied) => !boxesOverlap(candidate, occupied))
      ) ??
      candidates.find((candidate) => placements.every((placement) => !boxesOverlap(candidate, placement.box))) ??
      candidates[0];
    placements.push({
      region,
      x: (box.x0 + box.x1) / 2,
      y: box.y0 + 12,
      box
    });
  }
  return placements;
}

function stripMarkup(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const AUTHOR_PARTICLES = new Set(["da", "de", "del", "della", "der", "di", "dos", "du", "la", "le", "van", "von", "y"]);

function firstAuthorFamilyName(authors: string): string {
  const cleaned = authors.replace(/\s+et\s+al\.?$/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) return cleaned.split(",")[0].trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return cleaned;
  let familyStart = parts.length - 1;
  while (familyStart > 0 && AUTHOR_PARTICLES.has(parts[familyStart - 1].toLowerCase().replace(/\.$/, ""))) {
    familyStart -= 1;
  }
  return parts.slice(familyStart).join(" ");
}

function sourceLabel(record: PlotRecord): string {
  const authors = stripMarkup(record.publication_authors_short_verified);
  const year = record.publication_year_verified;
  const familyName = firstAuthorFamilyName(authors);
  if (familyName && year) return `${familyName} et al. ${year}`;
  const title = stripMarkup(record.publication_title_verified ?? record.citation_raw ?? record.public_sample_label ?? record.record_label);
  return title || record.record_id;
}

function labelText(record: PlotRecord): string {
  const raw = sourceLabel(record);
  return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
}

function calloutText(record: PlotRecord): string {
  return metalBenchmarkLabel(record) ?? labelText(record);
}

function labelWidth(text: string): number {
  return Math.min(170, Math.max(28, text.length * 5.6));
}

function closestPointOnBox(x: number, y: number, box: Box): { x: number; y: number } {
  return {
    x: clamp(x, box.x0, box.x1),
    y: clamp(y, box.y0, box.y1)
  };
}

function labelCandidateBoxes(record: PlotRecord, x: number, y: number, text: string, kind: LabelPlacement["kind"]): LabelPlacement[] {
  const width = labelWidth(text);
  const height = 18;
  const gap = kind === "benchmark" ? 11 : 13;
  const minX = MARGIN.left + 2;
  const maxX = WIDTH - MARGIN.right - width - 2;
  const minY = MARGIN.top + 2;
  const maxY = HEIGHT - MARGIN.bottom - height - 2;
  const rawCandidates: Array<{ x0: number; y0: number; textAnchor: LabelPlacement["textAnchor"]; priority: number }> =
    kind === "source"
      ? [
          { x0: x - width / 2, y0: y - 34, textAnchor: "middle", priority: 0 },
          { x0: x + gap, y0: y - 22, textAnchor: "start", priority: 1 },
          { x0: x - width / 2, y0: y + 16, textAnchor: "middle", priority: 2 },
          { x0: x + gap, y0: y - 8, textAnchor: "start", priority: 3 },
          { x0: x + gap, y0: y + 9, textAnchor: "start", priority: 4 },
          { x0: x - width - gap, y0: y - 22, textAnchor: "end", priority: 5 },
          { x0: x - width - gap, y0: y - 8, textAnchor: "end", priority: 6 },
          { x0: x - width - gap, y0: y + 9, textAnchor: "end", priority: 7 }
        ]
      : [
          { x0: x + gap, y0: y - 22, textAnchor: "start", priority: 0 },
          { x0: x + gap, y0: y - 8, textAnchor: "start", priority: 1 },
          { x0: x + gap, y0: y + 9, textAnchor: "start", priority: 2 },
          { x0: x - width - gap, y0: y - 22, textAnchor: "end", priority: 3 },
          { x0: x - width - gap, y0: y - 8, textAnchor: "end", priority: 4 },
          { x0: x - width - gap, y0: y + 9, textAnchor: "end", priority: 5 },
          { x0: x - width / 2, y0: y - 34, textAnchor: "middle", priority: 6 },
          { x0: x - width / 2, y0: y + 16, textAnchor: "middle", priority: 7 }
        ];

  return rawCandidates
    .map((candidate) => {
      const x0 = clamp(candidate.x0, minX, maxX);
      const y0 = clamp(candidate.y0, minY, maxY);
      const box = { x0, y0, x1: x0 + width, y1: y0 + height };
      const leader = closestPointOnBox(x, y, box);
      const clampedDistance = Math.abs(x0 - candidate.x0) + Math.abs(y0 - candidate.y0);
      const leaderLength = Math.hypot(leader.x - x, leader.y - y);
      return {
        record,
        x,
        y,
        textX: candidate.textAnchor === "end" ? box.x1 : candidate.textAnchor === "middle" ? (box.x0 + box.x1) / 2 : box.x0,
        textY: box.y0 + 12,
        textAnchor: candidate.textAnchor,
        leaderX: leader.x,
        leaderY: leader.y,
        box,
        text,
        kind,
        score: leaderLength + clampedDistance * 0.7 + candidate.priority * 2.4
      };
    })
    .filter((candidate) => Math.hypot(candidate.leaderX - x, candidate.leaderY - y) <= MAX_LABEL_LEADER_LENGTH)
    .sort((a, b) => a.score - b.score)
    .map(({ score: _score, ...candidate }) => candidate);
}

function pointAriaLabel(record: PlotRecord): string {
  return sourceLabel(record);
}

function PointMark({
  record,
  x,
  y,
  selected,
  highlighted,
  onSelect
}: {
  record: PlotRecord;
  x: number;
  y: number;
  selected: boolean;
  highlighted: boolean;
  onSelect: (record: PlotRecord) => void;
}) {
  const markerShape = formShape(record);
  const className = `plot-point ${shapeClass(markerShape)} ${materialClass(record)} ${selected ? "is-selected" : ""} ${highlighted ? "is-search-match" : ""}`;
  const radius = pointRadius(record);
  const size = radius * 1.85;
  const trianglePoints = `${x},${y - size * 0.68} ${x - size * 0.62},${y + size * 0.46} ${x + size * 0.62},${y + size * 0.46}`;
  const downTrianglePoints = `${x},${y + size * 0.68} ${x - size * 0.62},${y - size * 0.46} ${x + size * 0.62},${y - size * 0.46}`;
  const diamondPoints = `${x},${y - size * 0.72} ${x + size * 0.72},${y} ${x},${y + size * 0.72} ${x - size * 0.72},${y}`;
  const hexPoints = `${x - size * 0.58},${y - size * 0.48} ${x},${y - size * 0.68} ${x + size * 0.58},${y - size * 0.48} ${x + size * 0.58},${y + size * 0.48} ${x},${y + size * 0.68} ${x - size * 0.58},${y + size * 0.48}`;

  if (markerShape === "square") {
    return (
      <rect
        className={className}
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        rx={0.6}
        tabIndex={0}
        role="button"
        data-record-id={record.record_id}
        data-sample-label={record.public_sample_label ?? record.record_label ?? ""}
        aria-label={pointAriaLabel(record)}
        onClick={() => onSelect(record)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelect(record);
        }}
      />
    );
  }

  if (markerShape === "diamond" || markerShape === "triangle" || markerShape === "down-triangle" || markerShape === "hexagon") {
    const points =
      markerShape === "diamond"
        ? diamondPoints
        : markerShape === "triangle"
          ? trianglePoints
          : markerShape === "down-triangle"
            ? downTrianglePoints
            : hexPoints;
    return (
      <polygon
        className={className}
        points={points}
        tabIndex={0}
        role="button"
        data-record-id={record.record_id}
        data-sample-label={record.public_sample_label ?? record.record_label ?? ""}
        aria-label={pointAriaLabel(record)}
        onClick={() => onSelect(record)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelect(record);
        }}
      />
    );
  }

  return (
    <circle
      className={className}
      cx={x}
      cy={y}
      r={radius}
      tabIndex={0}
      role="button"
      data-record-id={record.record_id}
      data-sample-label={record.public_sample_label ?? record.record_label ?? ""}
      aria-label={pointAriaLabel(record)}
      onClick={() => onSelect(record)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect(record);
      }}
    />
  );
}

export function ScatterPlot({
  records,
  xKey,
  yKey,
  xMeta,
  yMeta,
  xScale,
  yScale,
  variant = "scatter",
  selectedId,
  highlightedIds = new Set<string>(),
  onSelect
}: ScatterPlotProps) {
  const plotRecords = records.filter((record) => {
    const x = record.values[xKey];
    const y = record.values[yKey];
    return (
      typeof x === "number" &&
      typeof y === "number" &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      (xScale === "linear" || x > 0) &&
      (yScale === "linear" || y > 0)
    );
  });
  const xValues = plotRecords.map((record) => record.values[xKey] as number);
  const yValues = plotRecords.map((record) => record.values[yKey] as number);
  const xDomain = extent(xValues, xScale);
  const yDomain = extent(yValues, yScale);
  const xRange: [number, number] = [MARGIN.left, WIDTH - MARGIN.right];
  const yRange: [number, number] = [HEIGHT - MARGIN.bottom, MARGIN.top];
  const xTicks = ticks(xDomain, xRange, xScale);
  const yTicks = ticks(yDomain, yRange, yScale);
  const xMinorTicks = minorLogTicks(xDomain, xRange, xScale);
  const yMinorTicks = minorLogTicks(yDomain, yRange, yScale);
  const familyRegions =
    variant === "ashby"
      ? ashbyRegions({
          records: plotRecords,
          xKey,
          yKey,
          xDomain,
          yDomain,
          xRange,
          yRange,
          xScale,
          yScale
        })
      : [];
  const pointBoxes = plotRecords.map((record) => {
    const x = scaleNumber(record.values[xKey] as number, xDomain, xRange, xScale);
    const y = scaleNumber(record.values[yKey] as number, yDomain, yRange, yScale);
    return {
      recordId: record.record_id,
      box: { x0: x - 7, y0: y - 7, x1: x + 7, y1: y + 7 }
    };
  });
  const regionLabelPlacements = placeRegionLabels(
    familyRegions,
    pointBoxes.map((point) => point.box)
  );
  const selected = plotRecords.find((record) => record.record_id === selectedId) ?? null;
  const metalLabelCandidates = plotRecords
    .filter((record) => metalBenchmarkLabel(record))
    .sort((a, b) => {
      const labelA = metalBenchmarkLabel(a) ?? "";
      const labelB = metalBenchmarkLabel(b) ?? "";
      const rankDiff = (METAL_BENCHMARK_ORDER.get(labelA) ?? 99) - (METAL_BENCHMARK_ORDER.get(labelB) ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return metricValue(b, yKey) - metricValue(a, yKey);
    })
    .filter((record, index, records) => {
      const label = metalBenchmarkLabel(record);
      return Boolean(label) && records.findIndex((candidate) => metalBenchmarkLabel(candidate) === label) === index;
    });
  const sourceLabelCandidates = plotRecords
    .filter((record) => record.material_family !== "metal_comparator" && record.public_release_tier === "peer_reviewed_research")
    .sort((a, b) => (b.values[yKey] ?? 0) - (a.values[yKey] ?? 0));
  const labels: LabelPlacement[] = [];
  let benchmarkLabelCount = 0;
  let sourceLabelCount = 0;
  for (const record of [...metalLabelCandidates, ...sourceLabelCandidates]) {
    const kind: LabelPlacement["kind"] = metalBenchmarkLabel(record) ? "benchmark" : "source";
    if (kind === "benchmark" && benchmarkLabelCount >= MAX_BENCHMARK_LABELS) continue;
    if (kind === "source" && sourceLabelCount >= MAX_SOURCE_LABELS) continue;
    const x = scaleNumber(record.values[xKey] as number, xDomain, xRange, xScale);
    const y = scaleNumber(record.values[yKey] as number, yDomain, yRange, yScale);
    const text = calloutText(record);
    const placement = labelCandidateBoxes(record, x, y, text, kind)
      .find(
        (candidate) =>
          labels.every((label) => !boxesOverlap(candidate.box, label.box)) &&
          regionLabelPlacements.every((label) => !boxesOverlap(candidate.box, label.box)) &&
          pointBoxes.every((point) => point.recordId === record.record_id || !boxesOverlap(candidate.box, point.box))
      );
    if (placement) {
      labels.push(placement);
      if (kind === "benchmark") benchmarkLabelCount += 1;
      else sourceLabelCount += 1;
    }
    if (labels.length >= MAX_TOTAL_LABELS) break;
  }

  return (
    <figure className="plot-figure" aria-label={`${xMeta.label} versus ${yMeta.label}`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="plot-svg" preserveAspectRatio="xMidYMin meet" role="img">
        <defs>
          <clipPath id="scatter-plot-area-clip">
            <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={HEIGHT - MARGIN.top - MARGIN.bottom} />
          </clipPath>
        </defs>
        <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={HEIGHT - MARGIN.top - MARGIN.bottom} className="plot-area" />

        {familyRegions.length ? (
          <g className="ashby-region-layer" clipPath="url(#scatter-plot-area-clip)">
            {familyRegions.map((region) => (
              <path
                key={`ashby-region-${region.key}`}
                d={region.path}
                data-core-count={region.coreCount}
                data-total-count={region.count}
                className={`ashby-region ${region.className}`}
              />
            ))}
          </g>
        ) : null}

        {xMinorTicks.map((tick) => (
          <line
            key={`x-minor-${tick.value}`}
            x1={tick.position}
            x2={tick.position}
            y1={MARGIN.top}
            y2={HEIGHT - MARGIN.bottom}
            className="minor-grid-line"
          />
        ))}

        {yMinorTicks.map((tick) => (
          <line
            key={`y-minor-${tick.value}`}
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={tick.position}
            y2={tick.position}
            className="minor-grid-line"
          />
        ))}

        {xTicks.map((tick) => (
          <g key={`x-${tick.value}`}>
            <line x1={tick.position} x2={tick.position} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="grid-line" />
            <line x1={tick.position} x2={tick.position} y1={HEIGHT - MARGIN.bottom} y2={HEIGHT - MARGIN.bottom + 5} className="axis-tick" />
            <text x={tick.position} y={HEIGHT - MARGIN.bottom + 22} textAnchor="middle" className="axis-text">
              {tick.label}
            </text>
          </g>
        ))}

        {yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={tick.position} y2={tick.position} className="grid-line" />
            <line x1={MARGIN.left - 5} x2={MARGIN.left} y1={tick.position} y2={tick.position} className="axis-tick" />
            <text x={MARGIN.left - 12} y={tick.position + 4} textAnchor="end" className="axis-text">
              {tick.label}
            </text>
          </g>
        ))}

        <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={HEIGHT - MARGIN.bottom} y2={HEIGHT - MARGIN.bottom} className="axis-line" />
        <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="axis-line" />

        {regionLabelPlacements.map((placement) => (
          <text key={`ashby-label-${placement.region.key}`} x={placement.x} y={placement.y} textAnchor="middle" className="ashby-region-label">
            {placement.region.label}
          </text>
        ))}

        <text x={WIDTH - MARGIN.right - 8} y={HEIGHT - MARGIN.bottom - 12} textAnchor="end" className="plot-watermark">
          CNT Property Atlas - cite original sources
        </text>

        {plotRecords
          .filter((record) => highlightedIds.has(record.record_id))
          .map((record) => {
            const x = scaleNumber(record.values[xKey] as number, xDomain, xRange, xScale);
            const y = scaleNumber(record.values[yKey] as number, yDomain, yRange, yScale);
            return (
              <g key={`search-halo-${record.record_id}`} className="search-highlight-halo">
                <circle cx={x} cy={y} r={13} />
              </g>
            );
          })}

        {plotRecords.map((record) => {
          const x = scaleNumber(record.values[xKey] as number, xDomain, xRange, xScale);
          const y = scaleNumber(record.values[yKey] as number, yDomain, yRange, yScale);
          return <PointMark key={record.record_id} record={record} x={x} y={y} selected={record.record_id === selectedId} highlighted={highlightedIds.has(record.record_id)} onSelect={onSelect} />;
        })}

        {labels.map((placement) => {
          return (
            <g key={`label-${placement.record.record_id}`} className="plot-label-group">
              <line x1={placement.x} y1={placement.y} x2={placement.leaderX} y2={placement.leaderY} className="label-leader" />
              <text x={placement.textX} y={placement.textY} textAnchor={placement.textAnchor} className="point-label">
                {placement.text}
              </text>
            </g>
          );
        })}

        {selected ? (
          <g className="selected-halo">
            <circle
              cx={scaleNumber(selected.values[xKey] as number, xDomain, xRange, xScale)}
              cy={scaleNumber(selected.values[yKey] as number, yDomain, yRange, yScale)}
              r={10}
            />
          </g>
        ) : null}

        <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 24} textAnchor="middle" className="axis-title">
          {xMeta.label} ({xMeta.displayUnit})
        </text>
        <text
          x={24}
          y={(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}
          textAnchor="middle"
          className="axis-title"
          transform={`rotate(-90 24 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2})`}
        >
          {yMeta.label} ({yMeta.displayUnit})
        </text>
        <ExportLegend records={plotRecords} width={WIDTH} y={HEIGHT + 18} />
      </svg>
    </figure>
  );
}
