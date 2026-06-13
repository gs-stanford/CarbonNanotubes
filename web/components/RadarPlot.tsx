"use client";

import type { PlotRecord, PropertyKey } from "@/lib/data";

export const RADAR_REQUIRED_KEYS: PropertyKey[] = [
  "specific_volume",
  "tensile_strength",
  "initial_modulus",
  "work_of_rupture",
  "electrical_conductivity",
  "thermal_conductivity"
];

type RadarAxis = {
  key: PropertyKey;
  label: string;
  unit: string;
};

type RadarPlotProps = {
  records: PlotRecord[];
  selectedRecord: PlotRecord;
};

const WIDTH = 720;
const HEIGHT = 450;
const CENTER = { x: 320, y: 218 };
const RADIUS = 154;

const RADAR_AXES: RadarAxis[] = [
  { key: "tensile_strength", label: "Strength", unit: "GPa" },
  { key: "initial_modulus", label: "Stiffness", unit: "GPa" },
  { key: "work_of_rupture", label: "Toughness", unit: "J g⁻¹" },
  { key: "electrical_conductivity", label: "Electrical conductivity", unit: "MS m⁻¹" },
  { key: "thermal_conductivity", label: "Thermal conductivity", unit: "W m⁻¹ K⁻¹" },
  { key: "specific_volume", label: "1/Density", unit: "cm³ g⁻¹" }
];

const AXIS_ANGLES = [-90, -30, 30, 90, 150, -150];

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

function valueFor(record: PlotRecord, key: PropertyKey): number {
  const value = record.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

export function isRadarCompleteRecord(record: PlotRecord): boolean {
  return RADAR_REQUIRED_KEYS.every((key) => {
    const value = valueFor(record, key);
    return Number.isFinite(value) && value > 0;
  });
}

function materialClass(record: PlotRecord): string {
  if (record.material_family === "CNT_or_CNT_hybrid") return "radar-material-cnt";
  if (record.material_family === "CNT_metal_composite") return "radar-material-cnt-metal";
  if (record.material_family === "graphene_or_GO_fiber") return "radar-material-graphene";
  if (record.material_family === "carbon_fiber_comparator") return "radar-material-carbon-fiber";
  if (record.material_family === "ceramic_or_glass_comparator") return "radar-material-ceramic";
  if (record.material_family === "polymer_fiber_comparator") return "radar-material-polymer";
  return "radar-material-other";
}

function pointAt(angleDeg: number, fraction: number) {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER.x + Math.cos(radians) * RADIUS * fraction,
    y: CENTER.y + Math.sin(radians) * RADIUS * fraction
  };
}

function pointsFor(fractions: number[]): string {
  return fractions
    .map((fraction, index) => {
      const point = pointAt(AXIS_ANGLES[index], fraction);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function formatValue(value: number, axis: RadarAxis): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : value >= 1 ? 2 : 3;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: digits })} ${axis.unit}`;
}

function recordTitle(record: PlotRecord): string {
  return stripMarkup(record.public_sample_label ?? record.sample_name ?? record.record_label) || stripMarkup(record.publication_title_verified) || record.record_id;
}

function sourceLine(record: PlotRecord): string {
  const source = [stripMarkup(record.publication_authors_short_verified), record.publication_year_verified].filter(Boolean).join(" ");
  if (source) return source;
  const publicationTitle = stripMarkup(record.publication_title_verified);
  if (publicationTitle) return publicationTitle;
  if (record.public_release_tier === "commercial_contextual_comparator") {
    return stripMarkup(record.public_plot_badge) || "Commercial/spec-sheet benchmark";
  }
  return stripMarkup(record.public_plot_badge ?? record.source_disclosure) || "Source pending";
}

export function RadarPlot({ records, selectedRecord }: RadarPlotProps) {
  const maxima = RADAR_AXES.map((axis) => Math.max(...records.map((record) => valueFor(record, axis.key)).filter((value) => Number.isFinite(value) && value > 0)));
  const normalized = RADAR_AXES.map((axis, index) => {
    const value = valueFor(selectedRecord, axis.key);
    const max = maxima[index];
    return max > 0 ? Math.min(value / max, 1) : 0;
  });
  const polygonPoints = pointsFor(normalized);
  const axisValues = RADAR_AXES.map((axis, index) => ({
    ...axis,
    value: valueFor(selectedRecord, axis.key),
    normalized: normalized[index]
  }));

  return (
    <div className="radar-comparison-grid">
      <figure className="radar-figure" aria-label={`Radar plot for ${recordTitle(selectedRecord)}`}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="radar-svg" role="img" aria-labelledby="radar-title">
          <title id="radar-title">{`Radar plot for ${recordTitle(selectedRecord)}`}</title>
          {[0.25, 0.5, 0.75, 1].map((fraction) => (
            <polygon key={`ring-${fraction}`} points={pointsFor(RADAR_AXES.map(() => fraction))} className="radar-ring" />
          ))}
          {RADAR_AXES.map((axis, index) => {
            const end = pointAt(AXIS_ANGLES[index], 1);
            const label = pointAt(AXIS_ANGLES[index], 1.22);
            const anchor = label.x < CENTER.x - 10 ? "end" : label.x > CENTER.x + 10 ? "start" : "middle";
            return (
              <g key={axis.key}>
                <line x1={CENTER.x} y1={CENTER.y} x2={end.x} y2={end.y} className="radar-axis-line" />
                <text x={label.x} y={label.y} textAnchor={anchor} className="radar-axis-label">
                  {axis.label}
                </text>
              </g>
            );
          })}
          <polygon points={pointsFor(RADAR_AXES.map(() => 1))} className="radar-max-envelope" />
          <polygon points={polygonPoints} className={`radar-polygon ${materialClass(selectedRecord)}`} />
          {normalized.map((fraction, index) => {
            const point = pointAt(AXIS_ANGLES[index], fraction);
            return <circle key={`radar-node-${RADAR_AXES[index].key}`} cx={point.x} cy={point.y} r={3.8} className={`radar-node ${materialClass(selectedRecord)}`} />;
          })}
          <text x={CENTER.x} y={HEIGHT - 18} textAnchor="middle" className="radar-note">
            normalized to axis maximum across {records.length} complete records
          </text>
        </svg>
      </figure>

      <div className="radar-record-card">
        <div className="rail-heading">Radar record</div>
        <h3>{recordTitle(selectedRecord)}</h3>
        <p>{sourceLine(selectedRecord)}</p>
        <dl className="radar-value-list">
          {axisValues.map((axis) => (
            <div key={axis.key}>
              <dt>{axis.label}</dt>
              <dd>
                <span>{formatValue(axis.value, axis)}</span>
                <em>{Math.round(axis.normalized * 100)}%</em>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
