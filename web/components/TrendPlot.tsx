"use client";

import type { KeyboardEvent } from "react";
import { ExportLegend } from "@/components/ExportLegend";
import type { PlotRecord, PropertyKey, PropertyMeta, ScaleMode } from "@/lib/data";

type TrendPlotProps = {
  records: PlotRecord[];
  yKey: PropertyKey;
  yMeta: PropertyMeta;
  yScale: ScaleMode;
  selectedId: string | null;
  onSelect: (record: PlotRecord) => void;
};

type Tick = {
  value: number;
  position: number;
  label: string;
};

type LabelPlacement = {
  record: PlotRecord;
  x: number;
  y: number;
  textX: number;
  textY: number;
  box: { x0: number; y0: number; x1: number; y1: number };
};

type MarkerShape = "circle" | "open-circle" | "square" | "diamond" | "triangle" | "down-triangle" | "hexagon";

const WIDTH = 920;
const HEIGHT = 560;
const MARGIN = { top: 42, right: 42, bottom: 74, left: 92 };
const LINEAR_TICK_TARGET = 6;
const AUTHOR_PARTICLES = new Set(["da", "de", "del", "della", "der", "di", "dos", "du", "la", "le", "van", "von", "y"]);

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
    return [Math.pow(10, Math.floor(Math.log10(min))), Math.pow(10, Math.ceil(Math.log10(max)))];
  }
  const pad = Math.max((max - min) * 0.06, Math.abs(max) * 0.02, 0.1);
  return niceLinearDomain(allNonNegative ? 0 : min - pad, max + pad, allNonNegative);
}

function yearDomain(years: number[]): [number, number] {
  if (!years.length) return [1991, new Date().getFullYear()];
  const min = Math.min(...years);
  const max = Math.max(...years);
  const lower = Math.max(1991, Math.floor(min / 5) * 5);
  const upper = Math.ceil(max / 5) * 5;
  return upper <= lower ? [lower, lower + 5] : [lower, upper];
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

function valueTicks(domain: [number, number], range: [number, number], mode: ScaleMode): Tick[] {
  if (mode === "log") {
    const start = Math.ceil(Math.log10(domain[0]));
    const end = Math.floor(Math.log10(domain[1]));
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
      const value = Math.pow(10, start + index);
      return { value, position: scaleNumber(value, domain, range, mode), label: formatTick(value) };
    });
  }

  const step = niceStep((domain[1] - domain[0]) / (LINEAR_TICK_TARGET - 1));
  const start = Math.ceil(domain[0] / step) * step;
  const values: number[] = [];
  for (let value = start; value <= domain[1] + step * 0.5; value += step) values.push(Number(value.toPrecision(12)));
  return values.map((value) => ({ value, position: scaleNumber(value, domain, range, mode), label: formatTick(value) }));
}

function yearTicks(domain: [number, number], range: [number, number]): Tick[] {
  const span = domain[1] - domain[0];
  const step = span <= 10 ? 2 : span <= 25 ? 5 : 10;
  const values: number[] = [];
  for (let year = Math.ceil(domain[0] / step) * step; year <= domain[1]; year += step) values.push(year);
  return values.map((value) => ({ value, position: scaleNumber(value, domain, range, "linear"), label: String(value) }));
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

function firstAuthorFamilyName(authors: string): string {
  const cleaned = authors.replace(/\s+et\s+al\.?$/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) return cleaned.split(",")[0].trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return cleaned;
  let familyStart = parts.length - 1;
  while (familyStart > 0 && AUTHOR_PARTICLES.has(parts[familyStart - 1].toLowerCase().replace(/\.$/, ""))) familyStart -= 1;
  return parts.slice(familyStart).join(" ");
}

function sourceLabel(record: PlotRecord): string {
  const familyName = firstAuthorFamilyName(stripMarkup(record.publication_authors_short_verified));
  const year = record.publication_year_verified;
  if (familyName && year) return `${familyName} et al. ${year}`;
  return stripMarkup(record.publication_title_verified ?? record.citation_raw ?? record.public_sample_label ?? record.record_label) || record.record_id;
}

function labelText(record: PlotRecord): string {
  const raw = sourceLabel(record);
  return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
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

function PointMark({ record, x, y, selected, onSelect }: { record: PlotRecord; x: number; y: number; selected: boolean; onSelect: (record: PlotRecord) => void }) {
  const markerShape = formShape(record);
  const className = `plot-point point-shape-${markerShape} ${materialClass(record)} ${selected ? "is-selected" : ""}`;
  const radius = 4.2;
  const size = radius * 1.85;
  const trianglePoints = `${x},${y - size * 0.68} ${x - size * 0.62},${y + size * 0.46} ${x + size * 0.62},${y + size * 0.46}`;
  const downTrianglePoints = `${x},${y + size * 0.68} ${x - size * 0.62},${y - size * 0.46} ${x + size * 0.62},${y - size * 0.46}`;
  const diamondPoints = `${x},${y - size * 0.72} ${x + size * 0.72},${y} ${x},${y + size * 0.72} ${x - size * 0.72},${y}`;
  const hexPoints = `${x - size * 0.58},${y - size * 0.48} ${x},${y - size * 0.68} ${x + size * 0.58},${y - size * 0.48} ${x + size * 0.58},${y + size * 0.48} ${x},${y + size * 0.68} ${x - size * 0.58},${y + size * 0.48}`;
  const keyHandler = (event: KeyboardEvent<SVGElement>) => {
    if (event.key === "Enter" || event.key === " ") onSelect(record);
  };

  if (markerShape === "square") {
    return <rect className={className} x={x - size / 2} y={y - size / 2} width={size} height={size} rx={0.6} tabIndex={0} role="button" aria-label={sourceLabel(record)} onClick={() => onSelect(record)} onKeyDown={keyHandler} />;
  }
  if (markerShape === "diamond" || markerShape === "triangle" || markerShape === "down-triangle" || markerShape === "hexagon") {
    const points = markerShape === "diamond" ? diamondPoints : markerShape === "triangle" ? trianglePoints : markerShape === "down-triangle" ? downTrianglePoints : hexPoints;
    return <polygon className={className} points={points} tabIndex={0} role="button" aria-label={sourceLabel(record)} onClick={() => onSelect(record)} onKeyDown={keyHandler} />;
  }
  return <circle className={className} cx={x} cy={y} r={radius} tabIndex={0} role="button" aria-label={sourceLabel(record)} onClick={() => onSelect(record)} onKeyDown={keyHandler} />;
}

function boxesOverlap(a: LabelPlacement["box"], b: LabelPlacement["box"]): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function TrendPlot({ records, yKey, yMeta, yScale, selectedId, onSelect }: TrendPlotProps) {
  const plotRecords = records.filter((record) => {
    const value = record.values[yKey];
    const year = record.publication_year_verified;
    return typeof value === "number" && Number.isFinite(value) && typeof year === "number" && Number.isFinite(year) && (yScale === "linear" || value > 0);
  });
  const yValues = plotRecords.map((record) => record.values[yKey] as number);
  const years = plotRecords.map((record) => record.publication_year_verified as number);
  const xDomain = yearDomain(years);
  const yDomain = extent(yValues, yScale);
  const xRange: [number, number] = [MARGIN.left, WIDTH - MARGIN.right];
  const yRange: [number, number] = [HEIGHT - MARGIN.bottom, MARGIN.top];
  const xTicks = yearTicks(xDomain, xRange);
  const yTicks = valueTicks(yDomain, yRange, yScale);
  const selected = plotRecords.find((record) => record.record_id === selectedId) ?? null;
  const labelCandidates = plotRecords.slice().sort((a, b) => (b.values[yKey] ?? 0) - (a.values[yKey] ?? 0));
  const labels: LabelPlacement[] = [];

  for (const record of labelCandidates) {
    const x = scaleNumber(record.publication_year_verified as number, xDomain, xRange, "linear");
    const y = scaleNumber(record.values[yKey] as number, yDomain, yRange, yScale);
    const text = labelText(record);
    const width = Math.min(170, Math.max(64, text.length * 5.6));
    const height = 18;
    const candidates = [
      { x0: x + 13, y0: y - 23 },
      { x0: x - width - 13, y0: y - 23 },
      { x0: x + 13, y0: y + 9 },
      { x0: x - width - 13, y0: y + 9 }
    ];
    const placement = candidates
      .map((box) => ({ record, x, y, textX: box.x0, textY: box.y0 + 12, box: { x0: box.x0, y0: box.y0, x1: box.x0 + width, y1: box.y0 + height } }))
      .find(
        (candidate) =>
          candidate.box.x0 >= MARGIN.left + 2 &&
          candidate.box.x1 <= WIDTH - MARGIN.right - 2 &&
          candidate.box.y0 >= MARGIN.top + 2 &&
          candidate.box.y1 <= HEIGHT - MARGIN.bottom - 2 &&
          labels.every((label) => !boxesOverlap(candidate.box, label.box))
      );
    if (placement) labels.push(placement);
    if (labels.length >= 4) break;
  }

  return (
    <figure className="plot-figure" aria-label={`${yMeta.label} by publication year`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="plot-svg" preserveAspectRatio="xMidYMin meet" role="img">
        <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={HEIGHT - MARGIN.top - MARGIN.bottom} className="plot-area" />

        {xTicks.map((tick) => (
          <g key={`trend-x-${tick.value}`}>
            <line x1={tick.position} x2={tick.position} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="grid-line" />
            <line x1={tick.position} x2={tick.position} y1={HEIGHT - MARGIN.bottom} y2={HEIGHT - MARGIN.bottom + 5} className="axis-tick" />
            <text x={tick.position} y={HEIGHT - MARGIN.bottom + 22} textAnchor="middle" className="axis-text">
              {tick.label}
            </text>
          </g>
        ))}

        {yTicks.map((tick) => (
          <g key={`trend-y-${tick.value}`}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={tick.position} y2={tick.position} className="grid-line" />
            <line x1={MARGIN.left - 5} x2={MARGIN.left} y1={tick.position} y2={tick.position} className="axis-tick" />
            <text x={MARGIN.left - 12} y={tick.position + 4} textAnchor="end" className="axis-text">
              {tick.label}
            </text>
          </g>
        ))}

        <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={HEIGHT - MARGIN.bottom} y2={HEIGHT - MARGIN.bottom} className="axis-line" />
        <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="axis-line" />

        <text x={WIDTH - MARGIN.right - 8} y={HEIGHT - MARGIN.bottom - 12} textAnchor="end" className="plot-watermark">
          CNT Property Atlas - cite original sources
        </text>

        {plotRecords.map((record) => {
          const x = scaleNumber(record.publication_year_verified as number, xDomain, xRange, "linear");
          const y = scaleNumber(record.values[yKey] as number, yDomain, yRange, yScale);
          return <PointMark key={record.record_id} record={record} x={x} y={y} selected={record.record_id === selectedId} onSelect={onSelect} />;
        })}

        {labels.map((placement) => {
          const leaderEndX = placement.textX > placement.x ? placement.box.x0 - 3 : placement.box.x1 + 3;
          return (
            <g key={`trend-label-${placement.record.record_id}`} className="plot-label-group">
              <line x1={placement.x} y1={placement.y} x2={leaderEndX} y2={placement.textY - 4} className="label-leader" />
              <text x={placement.textX} y={placement.textY} className="point-label">
                {labelText(placement.record)}
              </text>
            </g>
          );
        })}

        {selected ? (
          <g className="selected-halo">
            <circle cx={scaleNumber(selected.publication_year_verified as number, xDomain, xRange, "linear")} cy={scaleNumber(selected.values[yKey] as number, yDomain, yRange, yScale)} r={10} />
          </g>
        ) : null}

        <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 24} textAnchor="middle" className="axis-title">
          Publication year
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
