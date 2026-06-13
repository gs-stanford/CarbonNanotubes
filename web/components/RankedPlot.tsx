"use client";

import type { KeyboardEvent } from "react";
import type { PlotRecord, PropertyKey, PropertyMeta, ScaleMode } from "@/lib/data";

export type RankedReferenceLine = {
  label: string;
  value: number;
  className?: string;
};

type RankedPlotProps = {
  records: PlotRecord[];
  yKey: PropertyKey;
  yMeta: PropertyMeta;
  yScale: ScaleMode;
  referenceLines?: RankedReferenceLine[];
  selectedId: string | null;
  onSelect: (record: PlotRecord) => void;
};

type Tick = {
  value: number;
  position: number;
  label: string;
};

type MarkerShape = "circle" | "open-circle" | "square" | "diamond" | "triangle" | "down-triangle" | "hexagon";

const WIDTH = 920;
const HEIGHT = 560;
const MARGIN = { top: 64, right: 74, bottom: 70, left: 214 };
const MAX_ROWS = 18;
const LINEAR_TICK_TARGET = 6;
const REFERENCE_LABEL_LANES = 3;

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
  if (min === max) {
    if (scale === "log") {
      min /= 3;
      max *= 3;
    } else {
      max += Math.max(Math.abs(max) * 0.15, 1);
      min = 0;
    }
  }
  if (scale === "log") {
    return [Math.pow(10, Math.floor(Math.log10(min))), Math.pow(10, Math.ceil(Math.log10(max)))];
  }
  return niceLinearDomain(0, max * 1.06, true);
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
      return { value, position: scaleNumber(value, domain, range, mode), label: formatTick(value) };
    });
  }

  const step = niceStep((domain[1] - domain[0]) / (LINEAR_TICK_TARGET - 1));
  const start = Math.ceil(domain[0] / step) * step;
  const values: number[] = [];
  for (let value = start; value <= domain[1] + step * 0.5; value += step) values.push(Number(value.toPrecision(12)));
  return values.map((value) => ({ value, position: scaleNumber(value, domain, range, mode), label: formatTick(value) }));
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

function trimLabel(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function formatValue(value: number, meta: PropertyMeta): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: meta.precision,
    minimumFractionDigits: value < 10 && meta.precision > 0 ? Math.min(meta.precision, 1) : 0
  })}`;
}

function formatReferenceValue(value: number): string {
  const digits = Math.abs(value) < 0.1 ? 3 : Math.abs(value) < 10 ? 1 : Math.abs(value) < 100 ? 1 : 0;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
  const radius = 4.3;
  const size = radius * 1.95;
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

export function RankedPlot({ records, yKey, yMeta, yScale, referenceLines = [], selectedId, onSelect }: RankedPlotProps) {
  const plotRecords = records
    .filter((record) => {
      const value = record.values[yKey];
      return typeof value === "number" && Number.isFinite(value) && (yScale === "linear" || value > 0);
    })
    .sort((a, b) => (b.values[yKey] ?? 0) - (a.values[yKey] ?? 0))
    .slice(0, MAX_ROWS);

  const values = [
    ...plotRecords.map((record) => record.values[yKey] as number),
    ...referenceLines.map((line) => line.value).filter((value) => Number.isFinite(value) && (yScale === "linear" || value > 0))
  ];
  const xDomain = extent(values, yScale);
  const xRange: [number, number] = [MARGIN.left, WIDTH - MARGIN.right];
  const xTicks = ticks(xDomain, xRange, yScale);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const rowStep = plotRecords.length ? plotHeight / plotRecords.length : plotHeight;
  const selected = plotRecords.find((record) => record.record_id === selectedId) ?? null;
  const baseline = yScale === "log" ? xRange[0] : scaleNumber(0, xDomain, xRange, yScale);
  const referencePlacements = referenceLines
    .filter((line) => Number.isFinite(line.value) && (yScale === "linear" || line.value > 0))
    .map((line) => {
      const x = scaleNumber(line.value, xDomain, xRange, yScale);
      const text = `${line.label} ${formatReferenceValue(line.value)}`;
      const width = clamp(text.length * 6.2 + 16, 50, 132);
      return { line, x, text, width };
    })
    .sort((a, b) => a.x - b.x)
    .map((placement, index, placements) => {
      const nearbyBefore = placements.slice(0, index).filter((other) => Math.abs(other.x - placement.x) < 72).length;
      const lane = nearbyBefore % REFERENCE_LABEL_LANES;
      const tagX = clamp(placement.x - placement.width / 2, MARGIN.left + 4, WIDTH - MARGIN.right - placement.width - 4);
      const tagY = 10 + lane * 18;
      return { ...placement, tagX, tagY };
    });

  return (
    <figure className="plot-figure" aria-label={`Ranked ${yMeta.label}`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="plot-svg" preserveAspectRatio="xMidYMin meet" role="img">
        <rect x={MARGIN.left} y={MARGIN.top} width={WIDTH - MARGIN.left - MARGIN.right} height={plotHeight} className="plot-area" />

        {xTicks.map((tick) => (
          <g key={`ranked-x-${tick.value}`}>
            <line x1={tick.position} x2={tick.position} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="grid-line" />
            <line x1={tick.position} x2={tick.position} y1={HEIGHT - MARGIN.bottom} y2={HEIGHT - MARGIN.bottom + 5} className="axis-tick" />
            <text x={tick.position} y={HEIGHT - MARGIN.bottom + 22} textAnchor="middle" className="axis-text">
              {tick.label}
            </text>
          </g>
        ))}

        {referencePlacements.map(({ line, x, text, width, tagX, tagY }) => {
          const tagCenter = tagX + width / 2;
          return (
            <g key={`reference-${line.label}-${line.value}`}>
              <line x1={x} x2={x} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className={`rank-reference-line ${line.className ?? ""}`} />
              <line x1={x} x2={tagCenter} y1={MARGIN.top} y2={tagY + 18} className={`rank-reference-leader ${line.className ?? ""}`} />
              <rect x={tagX} y={tagY} width={width} height={17} rx={2.5} className={`rank-reference-tag ${line.className ?? ""}`} />
              <text x={tagCenter} y={tagY + 12.1} textAnchor="middle" className={`rank-reference-label ${line.className ?? ""}`}>
                {text}
              </text>
            </g>
          );
        })}

        {plotRecords.map((record, index) => {
          const value = record.values[yKey] as number;
          const x = scaleNumber(value, xDomain, xRange, yScale);
          const y = MARGIN.top + rowStep * (index + 0.5);
          return (
            <g key={record.record_id}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y} y2={y} className="rank-row-line" />
              <text x={MARGIN.left - 12} y={y + 4} textAnchor="end" className="rank-label">
                {trimLabel(sourceLabel(record), 30)}
              </text>
              <line x1={baseline} x2={x} y1={y} y2={y} className="rank-value-line" />
              <PointMark record={record} x={x} y={y} selected={record.record_id === selectedId} onSelect={onSelect} />
              <text x={Math.min(x + 10, WIDTH - MARGIN.right + 46)} y={y + 4} className="rank-value-text">
                {formatValue(value, yMeta)}
              </text>
            </g>
          );
        })}

        {selected ? (
          <g className="selected-halo">
            <circle cx={scaleNumber(selected.values[yKey] as number, xDomain, xRange, yScale)} cy={MARGIN.top + rowStep * (plotRecords.findIndex((record) => record.record_id === selected.record_id) + 0.5)} r={10} />
          </g>
        ) : null}

        <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={HEIGHT - MARGIN.bottom} y2={HEIGHT - MARGIN.bottom} className="axis-line" />
        <text x={WIDTH - MARGIN.right - 8} y={HEIGHT - MARGIN.bottom - 12} textAnchor="end" className="plot-watermark">
          CNT Property Atlas - cite original sources
        </text>
        <text x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 24} textAnchor="middle" className="axis-title">
          {yMeta.label} ({yMeta.displayUnit})
        </text>
      </svg>
    </figure>
  );
}
