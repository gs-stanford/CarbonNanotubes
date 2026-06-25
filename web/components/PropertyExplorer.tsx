"use client";

import { ArrowLeftRight, Check, Clipboard, Download, ExternalLink, FileText, Printer, Quote, RefreshCcw, Send, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { RankedPlot, type RankedReferenceLine } from "@/components/RankedPlot";
import { ScatterPlot } from "@/components/ScatterPlot";
import { TrendPlot } from "@/components/TrendPlot";
import type { ExplorerPayload, PlotRecord, PropertyKey, PropertyMeta, ScaleMode } from "@/lib/data";

type PropertyExplorerProps = {
  initialData: ExplorerPayload;
};

type PlotType = "scatter" | "ranked" | "trend" | "ashby";

const DEFAULT_SCALE: ScaleMode = "linear";
const DEFAULT_YEAR_MIN = 1991;

const PLOT_TYPES: Array<{ key: PlotType; label: string }> = [
  { key: "scatter", label: "Scatter" },
  { key: "ranked", label: "Ranked" },
  { key: "trend", label: "Trend" },
  { key: "ashby", label: "Ashby" }
];

const TIER_OPTIONS = [
  {
    key: "peer_reviewed_research",
    label: "Peer-reviewed research",
    short: "Research",
    defaultOn: true
  },
  {
    key: "peer_reviewed_contextual_comparator",
    label: "Peer-reviewed comparators",
    short: "Context",
    defaultOn: true
  },
  {
    key: "commercial_contextual_comparator",
    label: "Commercial/spec-sheet",
    short: "Spec",
    defaultOn: false
  }
];

const EXTRACTION_OPTIONS = [
  {
    key: "direct_or_source_table",
    label: "Direct/source-table values",
    short: "Direct",
    defaultOn: true
  },
  {
    key: "secondary_meta_analysis",
    label: "Secondary extracted values",
    short: "Secondary",
    defaultOn: true
  }
];

const NORMALIZED_KEYS = new Set<PropertyKey>([
  "density",
  "specific_volume",
  "specific_strength",
  "specific_modulus",
  "specific_electrical_conductivity",
  "specific_thermal_conductivity"
]);

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

const MATERIAL_CLASS: Record<string, string> = {
  CNT_or_CNT_hybrid: "material-cnt",
  CNT_metal_composite: "material-cnt-metal",
  graphene_or_GO_fiber: "material-graphene",
  carbon_fiber_comparator: "material-carbon-fiber",
  other_carbon_comparator: "material-other-carbon",
  polymer_fiber_comparator: "material-polymer",
  metal_comparator: "material-metal",
  ceramic_or_glass_comparator: "material-ceramic"
};

const FORM_SHAPE_CLASS: Record<string, string> = {
  fiber_yarn: "shape-circle",
  sheet_mat_film: "shape-down-triangle",
  buckypaper: "shape-square",
  foam_aerogel: "shape-open-circle",
  forest_array: "shape-triangle",
  individual_nanotube_or_bundle: "shape-diamond",
  bulk: "shape-hexagon",
  unknown: "shape-open-circle"
};

const LOW_DENSITY_CNT_FIBER_THRESHOLD_KG_M3 = 600;

const PERFORMANCE_TARGET_KEYS: PropertyKey[] = [
  "specific_electrical_conductivity",
  "electrical_conductivity",
  "specific_strength",
  "tensile_strength",
  "specific_modulus",
  "initial_modulus",
  "specific_thermal_conductivity",
  "thermal_conductivity",
  "ampacity",
  "work_of_rupture",
  "breaking_strain",
  "g_d_ratio"
];

const PERFORMANCE_TARGET_SET = new Set<PropertyKey>(PERFORMANCE_TARGET_KEYS);

const FORM_LABELS: Record<string, string> = {
  fiber_yarn: "Fiber / yarn",
  sheet_mat_film: "Sheet / mat / film",
  buckypaper: "Buckypaper",
  foam_aerogel: "Foam / aerogel",
  forest_array: "Forest / array",
  individual_nanotube_or_bundle: "Individual tube / bundle",
  bulk: "Bulk",
  unknown: "Unknown"
};

const RANKED_MATERIAL_FAMILIES = new Set([
  "carbon_fiber_comparator",
  "CNT_or_CNT_hybrid",
  "CNT_metal_composite",
  "graphene_or_GO_fiber"
]);

const RANKED_REFERENCE_LINES: Partial<Record<PropertyKey, RankedReferenceLine[]>> = {
  electrical_conductivity: [
    { label: "Ag", value: 63.0, className: "reference-silver" },
    { label: "Cu", value: 58.0, className: "reference-copper" },
    { label: "Al", value: 37.7, className: "reference-aluminum" }
  ],
  specific_electrical_conductivity: [
    { label: "Al", value: 13.96, className: "reference-aluminum" },
    { label: "Cu", value: 6.47, className: "reference-copper" },
    { label: "Ag", value: 6.0, className: "reference-silver" }
  ],
  thermal_conductivity: [
    { label: "Ag", value: 429, className: "reference-silver" },
    { label: "Cu", value: 401, className: "reference-copper" },
    { label: "Al", value: 237, className: "reference-aluminum" }
  ],
  specific_thermal_conductivity: [
    { label: "Al", value: 0.0878, className: "reference-aluminum" },
    { label: "Cu", value: 0.0448, className: "reference-copper" },
    { label: "Ag", value: 0.0409, className: "reference-silver" }
  ],
  tensile_strength: [
    { label: "Kevlar 49", value: 3.6, className: "reference-aramid" },
    { label: "PBO", value: 5.8, className: "reference-pbo" },
    { label: "T1000G CF", value: 6.4, className: "reference-carbon-reference" }
  ],
  specific_strength: [
    { label: "Kevlar 49", value: 2.5, className: "reference-aramid" },
    { label: "T1000G CF", value: 3.6, className: "reference-carbon-reference" },
    { label: "PBO", value: 3.8, className: "reference-pbo" }
  ],
  initial_modulus: [
    { label: "Kevlar 49", value: 112, className: "reference-aramid" },
    { label: "T1000G CF", value: 294, className: "reference-carbon-reference" },
    { label: "HM CF", value: 540, className: "reference-hm-carbon" }
  ],
  specific_modulus: [
    { label: "Kevlar 49", value: 78, className: "reference-aramid" },
    { label: "T1000G CF", value: 163, className: "reference-carbon-reference" },
    { label: "HM CF", value: 280, className: "reference-hm-carbon" }
  ]
};

type NumericFilterKey = "density" | "diameter" | "gauge_length_mm" | "temperature_C";

type NumericFilterState = Record<NumericFilterKey, { min: string; max: string }>;

type NumericFilterConfig = {
  key: NumericFilterKey;
  label: string;
  unit: string;
  getValue: (record: PlotRecord) => number | null;
};

const NUMERIC_FILTERS: NumericFilterConfig[] = [
  {
    key: "density",
    label: "Density",
    unit: "kg m⁻³",
    getValue: (record) => {
      const value = record.values.density;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    }
  },
  {
    key: "diameter",
    label: "Diameter",
    unit: "µm",
    getValue: (record) => {
      const value = record.values.diameter;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    }
  },
  {
    key: "gauge_length_mm",
    label: "Gauge length",
    unit: "mm",
    getValue: (record) => record.gauge_length_mm
  },
  {
    key: "temperature_C",
    label: "Temperature",
    unit: "°C",
    getValue: (record) => record.condition_temperature_C
  }
];

function emptyNumericFilters(): NumericFilterState {
  return {
    density: { min: "", max: "" },
    diameter: { min: "", max: "" },
    gauge_length_mm: { min: "", max: "" },
    temperature_C: { min: "", max: "" }
  };
}

const EXPORTED_FIGURE_CSS = `
svg.plot-svg { background: #ffffff; font-family: Arial, Helvetica, sans-serif; }
.plot-area { fill: #fcfdfc; }
.grid-line { stroke: #e4e8e2; stroke-width: 0.65; }
.minor-grid-line { stroke: rgba(216, 222, 214, 0.58); stroke-width: 0.42; stroke-dasharray: 1.6 3.2; vector-effect: non-scaling-stroke; }
.axis-line, .axis-tick { stroke: #171a16; stroke-width: 0.9; vector-effect: non-scaling-stroke; }
.axis-text { fill: #5e645c; font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; font-variant-numeric: tabular-nums; }
.axis-title { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; font-weight: 700; }
.ashby-region { opacity: 0.13; stroke-width: 1.1; stroke-dasharray: 5 3.5; vector-effect: non-scaling-stroke; pointer-events: none; }
.ashby-region-label { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 9.4px; font-weight: 700; paint-order: stroke; stroke: rgba(252, 253, 252, 0.92); stroke-width: 2.8px; pointer-events: none; }
.ashby-region-cnt { fill: #0072b2; stroke: #004f7a; }
.ashby-region-cnt-metal { fill: #d55e00; stroke: #8c3e00; }
.ashby-region-graphene { fill: #009e73; stroke: #006b4f; }
.ashby-region-carbon-fiber { fill: #4a4a4a; stroke: #202020; }
.ashby-region-other-carbon { fill: #8a8a8a; stroke: #5c5c5c; }
.ashby-region-polymer { fill: #e69f00; stroke: #9a6a00; }
.ashby-region-metal { fill: #cc79a7; stroke: #8c4d73; }
.ashby-region-ceramic { fill: #6a3d9a; stroke: #432667; }
.ashby-region-unknown { fill: #979d95; stroke: #60665f; }
.plot-point { cursor: pointer; stroke-width: 1.2; vector-effect: non-scaling-stroke; opacity: 0.95; }
.plot-point.is-selected { stroke-width: 1.8; opacity: 1; }
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
.point-label { fill: #171a16; font-family: Arial, Helvetica, sans-serif; font-size: 9.4px; font-weight: 700; paint-order: stroke; stroke: rgba(252, 253, 252, 0.95); stroke-width: 2.8px; }
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

function metaFor(properties: PropertyMeta[], key: PropertyKey): PropertyMeta {
  const meta = properties.find((item) => item.key === key);
  if (!meta) throw new Error(`Property metadata missing for ${key}`);
  return meta;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => {
    const labelA = FAMILY_LABELS[a] ?? FORM_LABELS[a] ?? a;
    const labelB = FAMILY_LABELS[b] ?? FORM_LABELS[b] ?? b;
    return labelA.localeCompare(labelB);
  });
}

function formatValue(value: number | undefined, meta: PropertyMeta): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: meta.precision,
    minimumFractionDigits: value < 10 && meta.precision > 0 ? Math.min(meta.precision, 1) : 0
  })} ${meta.displayUnit}`;
}

function formatPlainValue(value: number | string | null | undefined, fallback = "-"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fallback;
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return value;
}

function doiHref(value: string | null): string | null {
  if (!value) return null;
  const doi = value.split(";")[0]?.trim();
  if (!doi) return null;
  return doi.startsWith("10.") ? `https://doi.org/${doi}` : null;
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function doiValue(value: string | null | undefined): string | null {
  const doi = value?.split(";")[0]?.trim();
  return doi && doi.startsWith("10.") ? doi : null;
}

const NAME_PARTICLES = new Set(["da", "de", "del", "della", "der", "di", "dos", "du", "la", "le", "van", "von", "y"]);

function normalizeInitials(value: string): string {
  return value
    .replace(/\b([A-Z])\b/g, "$1.")
    .replace(/([A-Z])\.([A-Z])\./g, "$1. $2.")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenInitial(token: string): string {
  const cleaned = token.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ-]/g, "");
  return cleaned ? `${cleaned[0].toUpperCase()}.` : "";
}

function formatNatureAuthorName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.includes(",")) {
    const [family, given = ""] = cleaned.split(",", 2).map((part) => part.trim());
    return [family, normalizeInitials(given)].filter(Boolean).join(", ");
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return cleaned;
  let familyStart = parts.length - 1;
  while (familyStart > 0 && NAME_PARTICLES.has(parts[familyStart - 1].toLowerCase().replace(/\.$/, ""))) {
    familyStart -= 1;
  }
  const family = parts.slice(familyStart).join(" ");
  const initials = parts
    .slice(0, familyStart)
    .map((part) => {
      if (/^[A-Z](\.)?$/.test(part)) return `${part[0]}.`;
      if (/^([A-Z]\.)+$/.test(part)) return normalizeInitials(part);
      return tokenInitial(part);
    })
    .filter(Boolean)
    .join(" ");
  return [family, initials].filter(Boolean).join(", ");
}

function formatShortNatureAuthors(short: string | null | undefined): string {
  const cleaned = (short ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Unknown authors";
  const etAl = /\bet\s+al\.?$/i.test(cleaned);
  const firstAuthor = cleaned.replace(/\bet\s+al\.?$/i, "").trim();
  const formatted = formatNatureAuthorName(firstAuthor);
  return etAl ? `${formatted} et al.` : formatted;
}

function natureAuthors(full: string | null | undefined, short: string | null | undefined): string {
  const names = (full ?? "")
    .split(";")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) return formatShortNatureAuthors(short);
  const formatted = names.map(formatNatureAuthorName).filter(Boolean);
  if (formatted.length > 6) return `${formatted[0]} et al.`;
  if (formatted.length === 1) return formatted[0];
  return `${formatted.slice(0, -1).join(", ")} & ${formatted[formatted.length - 1]}`;
}

function formatJournalBlock(journal: string | null | undefined, issuePages: string | null | undefined): string {
  const cleanJournal = stripMarkup(journal ?? "");
  const parts = stripMarkup(issuePages ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!cleanJournal) return "";
  if (parts.length >= 3) return `${cleanJournal} ${parts[0]}, ${parts.slice(2).join(", ")}`;
  if (parts.length === 2) return `${cleanJournal} ${parts[0]}, ${parts[1]}`;
  if (parts.length === 1) return `${cleanJournal} ${parts[0]}`;
  return cleanJournal;
}

function formatNatureCitation(record: PlotRecord): string {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  const authors = natureAuthors(record.publication_authors_full_verified, record.publication_authors_short_verified);
  const title = stripMarkup(record.publication_title_verified ?? record.citation_raw ?? record.record_label);
  const journalBlock = formatJournalBlock(record.publication_journal_verified, record.publication_issue_pages_verified);
  const year = record.publication_year_verified ?? "n.d.";
  const doiBlock = doi ? ` https://doi.org/${doi}` : "";
  return `${authors} ${title}. ${journalBlock} (${year}).${doiBlock}`.replace(/\s+/g, " ").trim();
}

function formatSecondaryCitation(record: PlotRecord): string | null {
  if (!record.secondary_source_doi_raw) return null;
  if (record.secondary_source_doi_raw === "10.1002/adma.202008432") {
    return "Bulmer, J. S., Kaniyoor, A. & Elliott, J. A. A meta-analysis of conductive and strong carbon nanotube materials. Advanced Materials 33, 2008432 (2021). https://doi.org/10.1002/adma.202008432";
  }
  const year = record.secondary_source_year ?? 2021;
  return `${formatShortNatureAuthors(record.secondary_source_authors_short ?? "Bulmer et al.")} ${record.secondary_source_title ?? "A Meta-Analysis of Conductive and Strong Carbon Nanotube Materials"}. ${record.secondary_source_journal ?? "Advanced Materials"} (${year}). https://doi.org/${record.secondary_source_doi_raw}`;
}

function formatAtlasCitation(): string {
  return "Sharma, G. & Boies, A. M. CNT Property Atlas, version 0.1 (2026).";
}

function bibtexKey(record: PlotRecord): string {
  const author = (record.publication_authors_short_verified ?? "source").split(/\s+/)[0]?.replace(/[^A-Za-z0-9]/g, "") || "source";
  const year = record.publication_year_verified ?? "nd";
  return `${author}${year}_${record.record_id.slice(-6)}`;
}

function formatBibtex(record: PlotRecord): string {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  const title = stripMarkup(record.publication_title_verified ?? record.record_label);
  const fullAuthors = record.publication_authors_full_verified
    ? record.publication_authors_full_verified.split(";").map((name) => name.trim()).filter(Boolean).join(" and ")
    : formatShortNatureAuthors(record.publication_authors_short_verified).replace(/\s+et al\.$/, " and others");
  return `@article{${bibtexKey(record)},\n  title = {${title}},\n  author = {${fullAuthors}},\n  journal = {${stripMarkup(record.publication_journal_verified ?? "")}},\n  year = {${record.publication_year_verified ?? ""}},\n  doi = {${doi ?? ""}}\n}`;
}

function formatAtlasBibtex(): string {
  return "@misc{sharma_boies_cnt_property_atlas_2026,\n  title = {CNT Property Atlas},\n  author = {Sharma, Gaurav and Boies, Adam M.},\n  year = {2026},\n  version = {0.1}\n}";
}

function buildCsv(records: PlotRecord[], xKey: PropertyKey, yKey: PropertyKey, xMeta: PropertyMeta, yMeta: PropertyMeta): string {
  const headers = [
    "record_id",
    "public_sample_label",
    "material_family",
    "form_factor",
    "source_tier",
    "value_extraction_type",
    `x_${xKey}_${xMeta.displayUnit}`,
    `y_${yKey}_${yMeta.displayUnit}`,
    "doi",
    "publication"
  ];
  const rows = records.map((record) =>
    [
      record.record_id,
      record.public_sample_label,
      record.material_family,
      record.form_factor,
      record.public_release_tier,
      record.value_extraction_type,
      record.values[xKey],
      record.values[yKey],
      record.doi_verified ?? record.doi_raw ?? "",
      record.publication_title_verified ?? ""
    ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
  );
  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const cleaned = stripMarkup(value).replace(/\s+/g, " ").trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    unique.push(cleaned);
  }
  return unique;
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function prepareFigureSvg(svg: SVGSVGElement, figureTitle: string, includeXmlDeclaration = true): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll(".plot-watermark").forEach((node) => node.remove());
  clone.querySelectorAll(".selected-halo").forEach((node) => node.remove());
  clone.querySelectorAll(".is-selected").forEach((node) => {
    const className = node.getAttribute("class") ?? "";
    node.setAttribute("class", className.replace(/\bis-selected\b/g, "").replace(/\s+/g, " ").trim());
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("role", "img");
  clone.removeAttribute("style");
  const exportLegend = clone.querySelector<SVGGElement>(".export-legend");
  const viewBox = clone.getAttribute("viewBox")?.split(/\s+/).map(Number);
  if (exportLegend && viewBox?.length === 4 && viewBox.every((value) => Number.isFinite(value))) {
    const padding = Number(exportLegend.getAttribute("data-export-padding") ?? 72);
    clone.setAttribute("viewBox", `${viewBox[0]} ${viewBox[1]} ${viewBox[2]} ${viewBox[3] + Math.max(52, padding)}`);
  }
  clone.insertAdjacentHTML(
    "afterbegin",
    `<title>${escapeXml(stripMarkup(figureTitle))}</title><desc>Exported from CNT Property Atlas. Cite original plotted sources and the atlas.</desc><defs><style>${EXPORTED_FIGURE_CSS}</style></defs>`
  );
  const serialized = new XMLSerializer().serializeToString(clone);
  return includeXmlDeclaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}` : serialized;
}

function sourceRank(record: PlotRecord): number {
  if (record.public_release_tier === "peer_reviewed_research" && record.value_extraction_type !== "secondary_meta_analysis") return 0;
  if (record.public_release_tier === "peer_reviewed_research") return 1;
  if (record.public_release_tier === "peer_reviewed_contextual_comparator") return 2;
  return 3;
}

function defaultYearMin(value: number | null | undefined): number {
  return Math.max(value ?? DEFAULT_YEAR_MIN, DEFAULT_YEAR_MIN);
}

function groupPart(value: string | null | undefined, fallback = "unspecified"): string {
  const cleaned = stripMarkup(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function publicationGroupKey(record: PlotRecord): string {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  if (doi) return `doi:${doi.toLowerCase()}`;
  return [
    "publication",
    groupPart(record.publication_title_verified ?? record.citation_raw ?? record.source_file),
    groupPart(record.publication_authors_short_verified),
    record.publication_year_verified ?? "n.d."
  ].join("|");
}

function bestRecordGroupKey(record: PlotRecord): string {
  return [
    publicationGroupKey(record),
    record.material_family,
    record.form_factor,
    groupPart(record.cnt_type)
  ].join("|");
}

function displayMetric(record: PlotRecord, key: PropertyKey): number {
  const value = record.values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function representativePriorityKeys(xKey: PropertyKey, yKey: PropertyKey): PropertyKey[] {
  const axisKeys = [yKey, xKey];
  const activePerformanceKeys = axisKeys.filter((key) => PERFORMANCE_TARGET_SET.has(key));
  if (activePerformanceKeys.length) return activePerformanceKeys;
  return axisKeys;
}

function compareBestRecords(a: PlotRecord, b: PlotRecord, xKey: PropertyKey, yKey: PropertyKey): number {
  for (const key of representativePriorityKeys(xKey, yKey)) {
    const diff = displayMetric(b, key) - displayMetric(a, key);
    if (diff !== 0) return diff;
  }
  const sourceDiff = sourceRank(a) - sourceRank(b);
  if (sourceDiff !== 0) return sourceDiff;
  if (a.strict_comparison_ready !== b.strict_comparison_ready) return a.strict_comparison_ready ? -1 : 1;
  return (b.publication_year_verified ?? 0) - (a.publication_year_verified ?? 0);
}

function paretoPriorityKeys(xKey: PropertyKey, yKey: PropertyKey): PropertyKey[] {
  const keys = [xKey, yKey].filter((key) => PERFORMANCE_TARGET_SET.has(key));
  return Array.from(new Set(keys));
}

function recordDominates(candidate: PlotRecord, target: PlotRecord, keys: PropertyKey[]): boolean {
  let strictlyBetter = false;
  for (const key of keys) {
    const candidateValue = displayMetric(candidate, key);
    const targetValue = displayMetric(target, key);
    if (!Number.isFinite(candidateValue) || !Number.isFinite(targetValue)) return false;
    const tolerance = Math.max(Math.abs(candidateValue), Math.abs(targetValue), 1) * 1e-9;
    if (candidateValue + tolerance < targetValue) return false;
    if (candidateValue > targetValue + tolerance) strictlyBetter = true;
  }
  return strictlyBetter;
}

function reduceToBestRecords(records: PlotRecord[], xKey: PropertyKey, yKey: PropertyKey): PlotRecord[] {
  const best = new Map<string, PlotRecord>();
  for (const record of records) {
    const key = bestRecordGroupKey(record);
    const existing = best.get(key);
    if (!existing || compareBestRecords(record, existing, xKey, yKey) < 0) {
      best.set(key, record);
    }
  }
  return Array.from(best.values()).sort((a, b) => sourceRank(a) - sourceRank(b));
}

function reduceToParetoRecords(records: PlotRecord[], xKey: PropertyKey, yKey: PropertyKey): PlotRecord[] {
  const keys = paretoPriorityKeys(xKey, yKey);
  if (keys.length < 2) return reduceToBestRecords(records, xKey, yKey);

  const groups = new Map<string, PlotRecord[]>();
  for (const record of records) {
    const key = bestRecordGroupKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const retained: PlotRecord[] = [];
  for (const group of groups.values()) {
    const frontier = group.filter((record) => !group.some((other) => other.record_id !== record.record_id && recordDominates(other, record, keys)));
    retained.push(...frontier.sort((a, b) => compareBestRecords(a, b, xKey, yKey)));
  }
  return retained.sort((a, b) => sourceRank(a) - sourceRank(b));
}

function reduceToRepresentativeRecords(records: PlotRecord[], xKey: PropertyKey, yKey: PropertyKey, plotType: PlotType): PlotRecord[] {
  if (plotType === "scatter" || plotType === "ashby") {
    return reduceToParetoRecords(records, xKey, yKey);
  }
  return reduceToBestRecords(records, xKey, yKey);
}

function recordDisplayTitle(record: PlotRecord): string {
  const title = stripMarkup(record.publication_title_verified ?? record.citation_raw);
  if (title) return title;
  const label = stripMarkup(record.public_sample_label ?? record.record_label);
  return label || record.record_id;
}

function displaySampleLabel(record: PlotRecord): string {
  const sample = stripMarkup(record.public_sample_label ?? record.sample_name ?? "");
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  if (doi === "10.1038/srep00083" && /doped floating cat doulewall/i.test(sample)) {
    return "Iodine-doped floating-catalyst DWCNT cable";
  }
  return sample;
}

function displayCntType(record: PlotRecord): string | null {
  const doi = doiValue(record.doi_verified ?? record.doi_raw);
  if (doi === "10.1038/srep00083") return "DWCNT";
  return record.cnt_type;
}

function recordSampleSummary(record: PlotRecord): string {
  const title = groupPart(recordDisplayTitle(record));
  const sample = displaySampleLabel(record);
  const cntType = displayCntType(record);
  const parts = [];
  if (sample && groupPart(sample) !== title && !/^\(?\d+\)?$/.test(sample)) parts.push(sample);
  parts.push(FAMILY_LABELS[record.material_family] ?? record.material_family);
  parts.push(FORM_LABELS[record.form_factor] ?? record.form_factor);
  if (cntType) parts.push(cntType);
  return parts.join(" / ");
}

function hasLowDensitySpecificMetricCaveat(record: PlotRecord): boolean {
  const density = record.values.density;
  const specificElectricalConductivity = record.values.specific_electrical_conductivity;
  return (
    record.material_family === "CNT_or_CNT_hybrid" &&
    record.form_factor === "fiber_yarn" &&
    typeof density === "number" &&
    density > 0 &&
    density < LOW_DENSITY_CNT_FIBER_THRESHOLD_KG_M3 &&
    typeof specificElectricalConductivity === "number" &&
    specificElectricalConductivity > 0
  );
}

function lowDensityCaveatText(record: PlotRecord): string {
  const density = record.values.density;
  const densityText = typeof density === "number" ? `${density.toLocaleString("en-US", { maximumFractionDigits: 0 })} kg m⁻³` : "a low reported bulk density";
  return `Specific conductivity is normalized by reported bulk density. This record uses ${densityText}, so the mass-normalized value should be read with volumetric conductivity and packing density rather than treated as directly equivalent to a dense CNT fiber.`;
}

function parseNumericFilterValue(value: string): number | null {
  const clean = value.trim().replace(/,/g, "");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasActiveNumericFilters(filters: NumericFilterState): boolean {
  return NUMERIC_FILTERS.some((filter) => filters[filter.key].min.trim() || filters[filter.key].max.trim());
}

function recordPassesNumericFilters(record: PlotRecord, filters: NumericFilterState): boolean {
  for (const filter of NUMERIC_FILTERS) {
    const min = parseNumericFilterValue(filters[filter.key].min);
    const max = parseNumericFilterValue(filters[filter.key].max);
    if (min === null && max === null) continue;

    const value = filter.getValue(record);
    if (value === null || !Number.isFinite(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
  }
  return true;
}

export function PropertyExplorer({ initialData }: PropertyExplorerProps) {
  const [atlasData, setAtlasData] = useState(initialData);
  const initialYearMin = defaultYearMin(atlasData.summary.minYear);
  const initialYearMax = atlasData.summary.maxYear ?? new Date().getFullYear();
  const [xKey, setXKey] = useState<PropertyKey>("specific_strength");
  const [yKey, setYKey] = useState<PropertyKey>("specific_electrical_conductivity");
  const [xScale, setXScale] = useState<ScaleMode>(DEFAULT_SCALE);
  const [yScale, setYScale] = useState<ScaleMode>(DEFAULT_SCALE);
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(
    () => new Set(TIER_OPTIONS.filter((tier) => tier.defaultOn).map((tier) => tier.key))
  );
  const [selectedExtractions, setSelectedExtractions] = useState<Set<string>>(
    () => new Set(EXTRACTION_OPTIONS.filter((option) => option.defaultOn).map((option) => option.key))
  );
  const families = useMemo(() => uniqueSorted(atlasData.records.map((record) => record.material_family)), [atlasData.records]);
  const forms = useMemo(() => uniqueSorted(atlasData.records.map((record) => record.form_factor)), [atlasData.records]);
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(() => new Set(families));
  const [selectedForms, setSelectedForms] = useState<Set<string>>(() => new Set(forms));
  const [yearMin, setYearMin] = useState(initialYearMin);
  const [yearMax, setYearMax] = useState(initialYearMax);
  const [numericFilters, setNumericFilters] = useState<NumericFilterState>(() => emptyNumericFilters());
  const [plotType, setPlotType] = useState<PlotType>("scatter");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [citationOpen, setCitationOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null);
  const [submissionPacket, setSubmissionPacket] = useState<string | null>(null);
  const [submittingData, setSubmittingData] = useState(false);

  const isXyPlot = plotType === "scatter" || plotType === "ashby";
  const xMeta = metaFor(atlasData.properties, xKey);
  const yMeta = metaFor(atlasData.properties, yKey);
  const ashbyAxisLocked = plotType === "ashby";
  const effectiveXScale: ScaleMode = ashbyAxisLocked ? "log" : xScale;
  const effectiveYScale: ScaleMode = ashbyAxisLocked ? "log" : yScale;
  const normalizedComparisonView = isXyPlot ? NORMALIZED_KEYS.has(xKey) && NORMALIZED_KEYS.has(yKey) : NORMALIZED_KEYS.has(yKey);
  const figureTitle =
    plotType === "trend"
      ? `${yMeta.label} by publication year`
      : plotType === "ranked"
        ? `Ranked ${yMeta.label}`
        : plotType === "ashby"
          ? `Ashby plot: ${yMeta.label} vs ${xMeta.label}`
          : `${yMeta.label} vs ${xMeta.label}`;

  const eligibleRecords = useMemo(() => {
    return atlasData.records
      .filter((record) => {
        const x = record.values[xKey];
        const y = record.values[yKey];
        if (typeof y !== "number") return false;
        if (isXyPlot && typeof x !== "number") return false;
        if (isXyPlot && effectiveXScale === "log" && typeof x === "number" && x <= 0) return false;
        if (effectiveYScale === "log" && y <= 0) return false;
        if (!selectedTiers.has(record.public_release_tier)) return false;
        if (!selectedExtractions.has(record.value_extraction_type)) return false;
        if (!selectedFamilies.has(record.material_family)) return false;
        if (!selectedForms.has(record.form_factor)) return false;
        const year = record.publication_year_verified;
        if (typeof year === "number" && (year < yearMin || year > yearMax)) return false;
        if (!recordPassesNumericFilters(record, numericFilters)) return false;
        if (normalizedComparisonView) return record.normalized_comparison_eligible;
        return record.public_release_tier !== "commercial_contextual_comparator";
      })
      .sort((a, b) => sourceRank(a) - sourceRank(b));
  }, [atlasData.records, effectiveXScale, effectiveYScale, isXyPlot, normalizedComparisonView, numericFilters, selectedExtractions, selectedFamilies, selectedForms, selectedTiers, xKey, yKey, yearMax, yearMin]);

  const filteredRecords = useMemo(() => {
    return reduceToRepresentativeRecords(eligibleRecords, xKey, yKey, plotType);
  }, [eligibleRecords, plotType, xKey, yKey]);

  const plottedRecords = useMemo(() => {
    if (plotType !== "ranked") return filteredRecords;
    return filteredRecords.filter((record) => RANKED_MATERIAL_FAMILIES.has(record.material_family));
  }, [filteredRecords, plotType]);

  const selectedRecord = useMemo(() => {
    const explicit = plottedRecords.find((record) => record.record_id === selectedId);
    if (explicit) return explicit;
    return plottedRecords.slice().sort((a, b) => compareBestRecords(a, b, xKey, yKey))[0] ?? null;
  }, [plottedRecords, selectedId, xKey, yKey]);

  useEffect(() => {
    if (selectedRecord && selectedRecord.record_id !== selectedId) {
      setSelectedId(selectedRecord.record_id);
    }
  }, [selectedId, selectedRecord]);

  useEffect(() => {
    setAtlasData(initialData);
  }, [initialData]);

  useEffect(() => {
    setSelectedFamilies((current) => {
      if (families.every((family) => current.has(family))) return current;
      return new Set([...current, ...families]);
    });
  }, [families]);

  useEffect(() => {
    setSelectedForms((current) => {
      if (forms.every((form) => current.has(form))) return current;
      return new Set([...current, ...forms]);
    });
  }, [forms]);

  function toggleSetValue(value: string, setter: (next: Set<string>) => void, current: Set<string>) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function updateNumericFilter(key: NumericFilterKey, side: "min" | "max", value: string) {
    setNumericFilters((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [side]: value
      }
    }));
    setSelectedId(null);
  }

  function changeProperty(axis: "x" | "y", value: PropertyKey) {
    const nextScale: ScaleMode = ashbyAxisLocked ? "log" : DEFAULT_SCALE;
    if (axis === "x") {
      setXKey(value);
      setXScale(nextScale);
    } else {
      setYKey(value);
      setYScale(nextScale);
    }
    setSelectedId(null);
  }

  function resetView() {
    setXKey("specific_strength");
    setYKey("specific_electrical_conductivity");
    setXScale(ashbyAxisLocked ? "log" : DEFAULT_SCALE);
    setYScale(ashbyAxisLocked ? "log" : DEFAULT_SCALE);
    setSelectedTiers(new Set(TIER_OPTIONS.filter((tier) => tier.defaultOn).map((tier) => tier.key)));
    setSelectedExtractions(new Set(EXTRACTION_OPTIONS.filter((option) => option.defaultOn).map((option) => option.key)));
    setSelectedFamilies(new Set(families));
    setSelectedForms(new Set(forms));
    setYearMin(initialYearMin);
    setYearMax(initialYearMax);
    setNumericFilters(emptyNumericFilters());
    setSelectedId(null);
  }

  function downloadPlotCsv() {
    const csv = buildCsv(plottedRecords, xKey, yKey, xMeta, yMeta);
    downloadText(`cnt-property-atlas-${xKey}-vs-${yKey}.csv`, csv, "text/csv;charset=utf-8");
  }

  function downloadFigureSvg() {
    const svg = document.querySelector<SVGSVGElement>(".plot-svg");
    if (!svg) return;
    const serialized = prepareFigureSvg(svg, figureTitle);
    downloadText(`cnt-property-atlas-${plotType}-${xKey}-vs-${yKey}.svg`, serialized, "image/svg+xml;charset=utf-8");
  }

  function printFigurePdf() {
    const svg = document.querySelector<SVGSVGElement>(".plot-svg");
    if (!svg) return;
    const standaloneSvg = prepareFigureSvg(svg, figureTitle, false);
    const printWindow = window.open("", "_blank", "width=1100,height=820");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>CNT Property Atlas figure</title>
    <style>
      @page { size: landscape; margin: 14mm; }
      html, body { margin: 0; background: #ffffff; color: #171a16; font-family: Arial, Helvetica, sans-serif; }
      main { padding: 24px; }
      h1 { font-size: 15px; line-height: 1.2; margin: 0 0 14px; font-weight: 700; }
      svg { width: 100%; height: auto; display: block; }
      p { margin: 14px 0 0; font-size: 9.5px; line-height: 1.35; color: #555; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeXml(stripMarkup(figureTitle))}</h1>
      ${standaloneSvg}
      <p>When using this figure, cite the original plotted sources and Sharma, G. & Boies, A. M. CNT Property Atlas, version 0.1 (2026).</p>
    </main>
    <script>
      window.addEventListener("load", () => window.setTimeout(() => window.print(), 300));
    </script>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  }

  function downloadFigureCitations() {
    downloadText(`cnt-property-atlas-${plotType}-${xKey}-vs-${yKey}-citations.txt`, figureCitationDownloadText, "text/plain;charset=utf-8");
  }

  async function copyCitation(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedCitation(key);
    window.setTimeout(() => setCopiedCitation(null), 1400);
  }

  const sourceCounts = TIER_OPTIONS.map((tier) => ({
    ...tier,
    count: plottedRecords.filter((record) => record.public_release_tier === tier.key).length
  }));
  const extractionCounts = EXTRACTION_OPTIONS.map((option) => ({
    ...option,
    count: plottedRecords.filter((record) => record.value_extraction_type === option.key).length
  }));
  const familyOptions = plotType === "ranked" ? families.filter((family) => RANKED_MATERIAL_FAMILIES.has(family)) : families;
  const familyCounts = familyOptions.map((family) => ({
    key: family,
    label: FAMILY_LABELS[family] ?? family,
    className: MATERIAL_CLASS[family] ?? "material-unknown",
    selected: selectedFamilies.has(family),
    count: plottedRecords.filter((record) => record.material_family === family).length
  }));
  const legendFamilies = familyCounts.filter((family) => family.count > 0);
  const formCounts = forms.map((form) => ({
    key: form,
    label: FORM_LABELS[form] ?? form,
    className: FORM_SHAPE_CLASS[form] ?? "shape-open-circle",
    selected: selectedForms.has(form),
    count: plottedRecords.filter((record) => record.form_factor === form).length
  }));
  const legendForms = formCounts.filter((form) => form.count > 0);
  const numericFiltersActive = hasActiveNumericFilters(numericFilters);
  const rankedReferenceLines = plotType === "ranked" ? RANKED_REFERENCE_LINES[yKey] ?? [] : [];
  const detailMetricKeys = Array.from(new Set<PropertyKey>([xKey, yKey, "density", "diameter", "electrical_conductivity", "ampacity"])).filter(
    (key) => selectedRecord && typeof selectedRecord.values[key] === "number"
  );
  const sourceHref = selectedRecord ? doiHref(selectedRecord.doi_verified ?? selectedRecord.doi_raw) : null;
  const selectedSourceCitation = selectedRecord ? formatNatureCitation(selectedRecord) : "";
  const selectedAtlasCitation = formatAtlasCitation();
  const selectedAtlasBibtex = formatAtlasBibtex();
  const selectedLowDensityCaveat = selectedRecord ? hasLowDensitySpecificMetricCaveat(selectedRecord) : false;
  const figureSourceCitations = useMemo(() => uniqueText(plottedRecords.map(formatNatureCitation)), [plottedRecords]);
  const figureSecondaryCitations = useMemo(() => uniqueText(plottedRecords.map(formatSecondaryCitation)), [plottedRecords]);
  const figureBibtex = useMemo(() => uniqueText(plottedRecords.map(formatBibtex)), [plottedRecords]);
  const figureNatureCitations = useMemo(
    () => uniqueText([...figureSourceCitations, ...figureSecondaryCitations, selectedAtlasCitation]),
    [figureSecondaryCitations, figureSourceCitations, selectedAtlasCitation]
  );
  const figureCitationText = useMemo(() => {
    const lines = [
      `CNT Property Atlas figure: ${figureTitle}`,
      `${plottedRecords.length} plotted records; source filters active in the browser at export time.`,
      "",
      "Citations:",
      ...figureNatureCitations.map((citation, index) => `${index + 1}. ${citation}`)
    ];
    return lines.join("\n");
  }, [figureNatureCitations, figureTitle, plottedRecords.length]);
  const figureCitationDownloadText = useMemo(() => {
    const lines = [
      figureCitationText,
      "",
      "BibTeX:",
      ...figureBibtex,
      selectedAtlasBibtex
    ];
    return lines.join("\n");
  }, [figureBibtex, figureCitationText, selectedAtlasBibtex]);

  async function handleSubmitData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const packet = {
      schema_version: "cnt-property-atlas-submission-v0.1",
      created_at: new Date().toISOString(),
      publication: {
        doi: String(formData.get("doi") ?? "").trim(),
        title: String(formData.get("title") ?? "").trim(),
        year: String(formData.get("year") ?? "").trim()
      },
      sample: {
        sample_label: String(formData.get("sample_label") ?? "").trim(),
        material_family: String(formData.get("material_family") ?? "").trim(),
        form_factor: String(formData.get("form_factor") ?? "").trim(),
        cnt_type: String(formData.get("cnt_type") ?? "").trim(),
        synthesis_method: String(formData.get("synthesis_method") ?? "").trim(),
        postprocessing: String(formData.get("postprocessing") ?? "").trim()
      },
      measurements: Object.fromEntries(
        atlasData.properties.map((property) => [property.key, String(formData.get(`measurement_${property.key}`) ?? "").trim()])
      ),
      conditions: {
        temperature_C: String(formData.get("temperature_C") ?? "").trim(),
        atmosphere: String(formData.get("atmosphere") ?? "").trim(),
        measurement_method: String(formData.get("measurement_method") ?? "").trim(),
        gauge_length_mm: String(formData.get("gauge_length_mm") ?? "").trim(),
        strain_rate_s_inv: String(formData.get("strain_rate_s_inv") ?? "").trim()
      },
      provenance: {
        table_figure_page: String(formData.get("provenance") ?? "").trim(),
        notes: String(formData.get("notes") ?? "").trim()
      }
    };

    setSubmittingData(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packet)
      });
      const result = (await response.json()) as {
        ok?: boolean;
        payload?: ExplorerPayload;
        record?: PlotRecord;
        checks?: unknown;
        error?: unknown;
      };

      if (!response.ok || !result.ok || !result.payload || !result.record) {
        setSubmissionPacket(JSON.stringify({ status: "rejected", submitted: packet, response: result }, null, 2));
        return;
      }

      setAtlasData(result.payload);
      setSelectedId(result.record.record_id);
      setSubmissionPacket(
        JSON.stringify(
          {
            status: "accepted_and_plotted",
            record_id: result.record.record_id,
            checks: result.checks,
            doi: result.record.doi_verified,
            title: result.record.publication_title_verified
          },
          null,
          2
        )
      );
      form.reset();
    } catch {
      setSubmissionPacket(JSON.stringify({ status: "failed", submitted: packet, error: "Network or server error during submission." }, null, 2));
    } finally {
      setSubmittingData(false);
    }
  }

  return (
    <main className="atlas-shell">
      <header className="atlas-header">
        <div className="brand-block">
          <h1>CNT Property Atlas</h1>
        </div>
        <nav className="header-nav" aria-label="Atlas sections">
          <button type="button" onClick={() => setCitationOpen(true)}>
            How to cite
          </button>
        </nav>
        <div className="header-actions" aria-label="View actions">
          <button className="header-action-link" type="button" onClick={() => setSubmitOpen(true)} title="Submit data" aria-label="Submit data form">
            <Send size={16} strokeWidth={1.8} />
            <span>Submit data</span>
          </button>
          <button className="header-action-link header-action-primary" type="button" onClick={() => setExportOpen(true)} title="Download Figure" aria-label="Download Figure">
            <Download size={18} strokeWidth={2} />
            <span>Download Figure</span>
          </button>
          <button className="header-action-link" type="button" onClick={resetView} title="Reset view" aria-label="Reset view">
            <RefreshCcw size={16} strokeWidth={1.8} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      <div className="atlas-workspace">
        <aside className="control-rail" aria-label="Plot controls">
          <section className="rail-section axis-section">
            <div className="rail-heading">Plot setup</div>
            {isXyPlot ? (
              <>
                <label className="field-label" htmlFor="x-property">
                  X property
                </label>
                <select id="x-property" value={xKey} onChange={(event) => changeProperty("x", event.target.value as PropertyKey)}>
                  {atlasData.properties.map((property) => (
                    <option key={property.key} value={property.key}>
                      {property.label}
                    </option>
                  ))}
                </select>
                <p className="unit-hint">({xMeta.displayUnit})</p>
                <div className="scale-row">
                  <button className={effectiveXScale === "linear" ? "segmented is-active" : "segmented"} type="button" disabled={ashbyAxisLocked} onClick={() => setXScale("linear")}>
                    Linear
                  </button>
                  <button className={effectiveXScale === "log" ? "segmented is-active" : "segmented"} type="button" disabled={ashbyAxisLocked} onClick={() => setXScale("log")}>
                    Log
                  </button>
                </div>

                <button
                  className="swap-button"
                  type="button"
                  title="Swap axes"
                  aria-label="Swap axes"
                  onClick={() => {
                    const nextX = yKey;
                    const nextY = xKey;
                    const nextXScale = ashbyAxisLocked ? "log" : yScale;
                    const nextYScale = ashbyAxisLocked ? "log" : xScale;
                    setXKey(nextX);
                    setYKey(nextY);
                    setXScale(nextXScale);
                    setYScale(nextYScale);
                    setSelectedId(null);
                  }}
                >
                  <ArrowLeftRight size={15} strokeWidth={1.7} />
                </button>
              </>
            ) : null}

            <label className="field-label" htmlFor="y-property">
              {isXyPlot ? "Y property" : "Property"}
            </label>
            <select id="y-property" value={yKey} onChange={(event) => changeProperty("y", event.target.value as PropertyKey)}>
              {atlasData.properties.map((property) => (
                <option key={property.key} value={property.key}>
                  {property.label}
                </option>
              ))}
            </select>
            <p className="unit-hint">({yMeta.displayUnit})</p>
            <div className="scale-row">
              <button className={effectiveYScale === "linear" ? "segmented is-active" : "segmented"} type="button" disabled={ashbyAxisLocked} onClick={() => setYScale("linear")}>
                Linear
              </button>
              <button className={effectiveYScale === "log" ? "segmented is-active" : "segmented"} type="button" disabled={ashbyAxisLocked} onClick={() => setYScale("log")}>
                Log
              </button>
            </div>
          </section>

          <section className="rail-section">
            <div className="rail-heading">Source class</div>
            {TIER_OPTIONS.map((tier) => (
              <label key={tier.key} className="check-row">
                <input
                  type="checkbox"
                  checked={selectedTiers.has(tier.key)}
                  onChange={() => toggleSetValue(tier.key, setSelectedTiers, selectedTiers)}
                />
                <span>{tier.label}</span>
                <span className="count">{sourceCounts.find((item) => item.key === tier.key)?.count ?? 0}</span>
              </label>
            ))}
          </section>

          <section className="rail-section">
            <div className="rail-heading">Value extraction</div>
            {EXTRACTION_OPTIONS.map((option) => (
              <label key={option.key} className="check-row">
                <input
                  type="checkbox"
                  checked={selectedExtractions.has(option.key)}
                  onChange={() => toggleSetValue(option.key, setSelectedExtractions, selectedExtractions)}
                />
                <span>{option.label}</span>
                <span className="count">{extractionCounts.find((item) => item.key === option.key)?.count ?? 0}</span>
              </label>
            ))}
          </section>

          <section className="rail-section">
            <div className="rail-heading">Material family</div>
            {familyCounts.map((family) => (
              <label key={family.key} className="check-row compact family-check-row">
                <input type="checkbox" checked={selectedFamilies.has(family.key)} onChange={() => toggleSetValue(family.key, setSelectedFamilies, selectedFamilies)} />
                <i className={`material-swatch ${family.className}`} aria-hidden="true" />
                <span>{family.label}</span>
                <span className="count">{family.count}</span>
              </label>
            ))}
          </section>

          <section className="rail-section">
            <div className="rail-heading">Form factor</div>
            {formCounts.map((form) => (
              <label key={form.key} className="check-row compact family-check-row">
                <input type="checkbox" checked={selectedForms.has(form.key)} onChange={() => toggleSetValue(form.key, setSelectedForms, selectedForms)} />
                <i className={`shape-swatch ${form.className}`} aria-hidden="true" />
                <span>{form.label}</span>
                <span className="count">{form.count}</span>
              </label>
            ))}
          </section>

          <section className="rail-section">
            <div className="rail-heading">Year</div>
            <div className="year-row">
              <input type="number" value={yearMin} onChange={(event) => setYearMin(Number(event.target.value))} aria-label="Minimum publication year" />
              <span>to</span>
              <input type="number" value={yearMax} onChange={(event) => setYearMax(Number(event.target.value))} aria-label="Maximum publication year" />
            </div>
          </section>

          <section className="rail-section">
            <div className="rail-heading">
              Numeric filters
              {numericFiltersActive ? <span className="rail-heading-note">active</span> : null}
            </div>
            <div className="numeric-filter-grid">
              {NUMERIC_FILTERS.map((filter) => (
                <div className="numeric-filter-row" key={filter.key}>
                  <div>
                    <span>{filter.label}</span>
                    <small>{filter.unit}</small>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="min"
                    value={numericFilters[filter.key].min}
                    onChange={(event) => updateNumericFilter(filter.key, "min", event.target.value)}
                    aria-label={`Minimum ${filter.label}`}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="max"
                    value={numericFilters[filter.key].max}
                    onChange={(event) => updateNumericFilter(filter.key, "max", event.target.value)}
                    aria-label={`Maximum ${filter.label}`}
                  />
                </div>
              ))}
            </div>
            <p className="filter-note">Active numeric filters require reported metadata for that field.</p>
          </section>

        </aside>

        <section className="plot-panel" aria-label="Property plot">
          <div className="plot-title-row">
            <div className="plot-heading">
              <h2>
                {figureTitle}
              </h2>
              <p>Watermark is removed from exported SVG/PDF files; export includes a citation file for the active figure.</p>
            </div>
            <div className="plot-toolbar">
              <div className="plot-type-tabs" role="tablist" aria-label="Plot type">
                {PLOT_TYPES.map((type) => (
                  <button
                    key={type.key}
                    className={plotType === type.key ? "mode-button is-active" : "mode-button"}
                    type="button"
                    role="tab"
                    aria-selected={plotType === type.key}
                    onClick={() => {
                      setPlotType(type.key);
                      if (type.key === "ashby") {
                        setXScale("log");
                        setYScale("log");
                      }
                      setSelectedId(null);
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="encoding-legend" aria-label="Visual encoding legend">
              <div className="legend-group">
                <span className="legend-title">Color</span>
                {legendFamilies.map((family) => (
                  <span key={family.key} className={family.count === 0 ? "is-muted" : undefined}>
                    <i className={`material-swatch ${family.className}`} /> {family.label}
                    <b className="legend-count">{family.count}</b>
                  </span>
                ))}
              </div>
              <div className="legend-group">
                <span className="legend-title">Shape</span>
                {legendForms.map((form) => (
                  <span key={form.key} className={form.count === 0 ? "is-muted" : undefined}>
                    <i className={`shape-swatch ${form.className}`} /> {form.label}
                    <b className="legend-count">{form.count}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {plotType === "scatter" || plotType === "ashby" ? (
            <ScatterPlot
              records={plottedRecords}
              xKey={xKey}
              yKey={yKey}
              xMeta={xMeta}
              yMeta={yMeta}
              xScale={effectiveXScale}
              yScale={effectiveYScale}
              variant={plotType === "ashby" ? "ashby" : "scatter"}
              selectedId={selectedRecord?.record_id ?? null}
              onSelect={(record) => setSelectedId(record.record_id)}
            />
          ) : null}
          {plotType === "ranked" ? (
            <RankedPlot
              records={plottedRecords}
              yKey={yKey}
              yMeta={yMeta}
              yScale={effectiveYScale}
              referenceLines={rankedReferenceLines}
              selectedId={selectedRecord?.record_id ?? null}
              onSelect={(record) => setSelectedId(record.record_id)}
            />
          ) : null}
          {plotType === "trend" ? (
            <TrendPlot records={plottedRecords} yKey={yKey} yMeta={yMeta} yScale={effectiveYScale} selectedId={selectedRecord?.record_id ?? null} onSelect={(record) => setSelectedId(record.record_id)} />
          ) : null}

        </section>

        <aside className="detail-rail" aria-label="Focused record">
          <section className="detail-section">
            <div className="rail-heading">Selected point</div>
            {selectedRecord ? (
              <>
                <h3>{recordDisplayTitle(selectedRecord)}</h3>
                <p className="detail-meta">
                  {recordSampleSummary(selectedRecord)}
                </p>
                <div className="badge-line">
                  <span className={`tier-badge ${selectedRecord.contextual_benchmark ? "context" : "primary"}`}>
                    {selectedRecord.public_plot_badge}
                  </span>
                  {selectedRecord.value_extraction_type === "secondary_meta_analysis" ? <span className="tier-badge secondary">secondary extraction</span> : null}
                  {selectedRecord.duplicate_group_id ? <span className="tier-badge primary">canonicalized</span> : null}
                  {selectedLowDensityCaveat ? <span className="tier-badge warning">low-density basis</span> : null}
                  {selectedRecord.missing_conditions ? <span className="tier-badge warning">missing conditions</span> : null}
                  {selectedRecord.unit_inference_review_needed ? <span className="tier-badge warning">unit review</span> : null}
                </div>
                <dl className="metric-list">
                  {detailMetricKeys.map((key) => {
                    const meta = metaFor(atlasData.properties, key);
                    return (
                      <div key={key}>
                        <dt>{meta.label}</dt>
                        <dd>{formatValue(selectedRecord.values[key], meta)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </>
            ) : (
              <p className="detail-meta">No records match the active filters.</p>
            )}
          </section>

          {selectedRecord ? (
            <>
              <section className="detail-section">
                <div className="rail-heading">Source</div>
                <p className="source-title">{selectedRecord.publication_title_verified ?? selectedRecord.citation_raw ?? selectedRecord.source_file}</p>
                <p className="detail-meta">{formatPlainValue(selectedRecord.publication_authors_short_verified, "")}</p>
                <p className="detail-meta">
                  {[selectedRecord.publication_journal_verified, selectedRecord.publication_year_verified].filter(Boolean).join(" / ")}
                </p>
                {sourceHref ? (
                  <a className="doi-link" href={sourceHref} target="_blank" rel="noreferrer">
                    {selectedRecord.doi_verified ?? selectedRecord.doi_raw}
                    <ExternalLink size={12} strokeWidth={1.8} />
                  </a>
                ) : (
                  <p className="doi-line">{selectedRecord.doi_verified ?? selectedRecord.doi_raw ?? selectedRecord.url_raw ?? "source pending"}</p>
                )}
              </section>

              <section className="detail-section">
                <div className="rail-heading">Measurement conditions</div>
                <dl className="detail-table">
                  <div>
                    <dt>Temperature</dt>
                    <dd>{selectedRecord.condition_temperature_C !== null ? `${selectedRecord.condition_temperature_C} °C` : "-"}</dd>
                  </div>
                  <div>
                    <dt>Atmosphere</dt>
                    <dd>{formatPlainValue(selectedRecord.condition_atmosphere)}</dd>
                  </div>
                  <div>
                    <dt>Method</dt>
                    <dd>{formatPlainValue(selectedRecord.measurement_method)}</dd>
                  </div>
                  <div>
                    <dt>Gauge length</dt>
                    <dd>{selectedRecord.gauge_length_mm !== null ? `${selectedRecord.gauge_length_mm} mm` : "-"}</dd>
                  </div>
                  <div>
                    <dt>Strain rate</dt>
                    <dd>{selectedRecord.strain_rate_s_inv !== null ? `${selectedRecord.strain_rate_s_inv.toPrecision(3)} s⁻¹` : "-"}</dd>
                  </div>
                </dl>
              </section>

              {selectedLowDensityCaveat ? (
                <section className="detail-section">
                  <div className="rail-heading">Interpretation caveat</div>
                  <p className="caveat-text">{lowDensityCaveatText(selectedRecord)}</p>
                </section>
              ) : null}

              <section className="detail-section" id="citation">
                <div className="rail-heading">Citation</div>
                <p className="citation-preview">{selectedSourceCitation}</p>
                <button className="citation-button" type="button" onClick={() => setCitationOpen(true)}>
                  <Quote size={14} strokeWidth={1.8} />
                  Open citation tool
                </button>
              </section>
            </>
          ) : null}
        </aside>
      </div>
      {citationOpen ? (
        <div className="citation-modal" role="dialog" aria-modal="true" aria-labelledby="citation-title">
          <div className="citation-card citation-card-wide">
            <div className="citation-card-header">
              <div>
                <p className="plot-kicker">Citation tool</p>
                <h2 id="citation-title">Citations for the current figure</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setCitationOpen(false)} aria-label="Close citation tool">
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>

            <div className="citation-list">
              <section>
                <div className="rail-heading">Active figure</div>
                <p>
                  This citation set covers the active plotted figure: {plottedRecords.length} plotted records and {figureNatureCitations.length} total citations.
                </p>
                <button className="copy-button" type="button" onClick={() => copyCitation("figure-all", figureCitationText)}>
                  {copiedCitation === "figure-all" ? <Check size={14} /> : <Clipboard size={14} />}
                  {copiedCitation === "figure-all" ? "Copied" : "Copy all citations"}
                </button>
              </section>

              <section>
                <div className="rail-heading">Atlas</div>
                <p>{selectedAtlasCitation}</p>
              </section>

              <section>
                <div className="rail-heading">Original sources</div>
                <ol className="citation-source-list">
                  {figureSourceCitations.map((citation) => (
                    <li key={citation}>{citation}</li>
                  ))}
                </ol>
              </section>

              <section>
                <div className="rail-heading">Compilation / secondary sources</div>
                {figureSecondaryCitations.length ? (
                  <ol className="citation-source-list">
                    {figureSecondaryCitations.map((citation) => (
                      <li key={citation}>{citation}</li>
                    ))}
                  </ol>
                ) : (
                  <p>No secondary compilation source is active in this figure.</p>
                )}
              </section>

              <section className="bibtex-section">
                <div className="rail-heading">BibTeX</div>
                <pre>{`${figureBibtex.join("\n\n")}\n\n${selectedAtlasBibtex}`}</pre>
                <button className="copy-button" type="button" onClick={() => copyCitation("bibtex", `${figureBibtex.join("\n\n")}\n\n${selectedAtlasBibtex}`)}>
                  {copiedCitation === "bibtex" ? <Check size={14} /> : <Clipboard size={14} />}
                  {copiedCitation === "bibtex" ? "Copied" : "Copy BibTeX"}
                </button>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {exportOpen ? (
        <div className="citation-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div className="citation-card export-card">
            <div className="citation-card-header">
              <div>
                <p className="plot-kicker">Figure export</p>
                <h2 id="export-title">Download figure and citations</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setExportOpen(false)} aria-label="Close export">
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>
            <div className="export-list">
              <button className="export-option" type="button" onClick={downloadFigureSvg}>
                <Download size={16} strokeWidth={1.8} />
                <span>
                  <strong>Download SVG</strong>
                  <small>Vector figure without the on-screen watermark.</small>
                </span>
              </button>
              <button className="export-option" type="button" onClick={printFigurePdf}>
                <Printer size={16} strokeWidth={1.8} />
                <span>
                  <strong>Save PDF</strong>
                  <small>Opens the browser print dialog; choose Save as PDF.</small>
                </span>
              </button>
              <button className="export-option" type="button" onClick={downloadFigureCitations}>
                <FileText size={16} strokeWidth={1.8} />
                <span>
                  <strong>Download citations</strong>
                  <small>Single citation list plus BibTeX for the active figure.</small>
                </span>
              </button>
              <button className="export-option" type="button" onClick={downloadPlotCsv}>
                <Download size={16} strokeWidth={1.8} />
                <span>
                  <strong>Download plotted CSV</strong>
                  <small>Current filtered records and active x/y values.</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {submitOpen ? (
        <div className="citation-modal" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="citation-card submit-card">
            <div className="citation-card-header">
              <div>
                <p className="plot-kicker">Submission packet</p>
                <h2 id="submit-title">Submit data for curator review</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setSubmitOpen(false)} aria-label="Close submit data">
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>

            <form className="submit-form" onSubmit={handleSubmitData}>
              <section>
                <div className="rail-heading">Publication</div>
                <label className="form-field">
                  <span>DOI</span>
                  <input name="doi" type="text" placeholder="10.xxxx/xxxxx" required />
                </label>
                <label className="form-field">
                  <span>Title</span>
                  <input name="title" type="text" placeholder="Publication title" />
                </label>
                <label className="form-field">
                  <span>Year</span>
                  <input name="year" type="number" min="1991" max="2100" placeholder="2026" />
                </label>
              </section>

              <section>
                <div className="rail-heading">Sample</div>
                <label className="form-field form-field-wide">
                  <span>Sample label</span>
                  <input name="sample_label" type="text" placeholder="Specific fiber, mat, film, or benchmark label" required />
                </label>
                <label className="form-field">
                  <span>Material family</span>
                  <select name="material_family" defaultValue="CNT_or_CNT_hybrid">
                    {families.map((family) => (
                      <option key={family} value={family}>
                        {FAMILY_LABELS[family] ?? family}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Form factor</span>
                  <select name="form_factor" defaultValue="fiber_yarn">
                    {forms.map((form) => (
                      <option key={form} value={form}>
                        {FORM_LABELS[form] ?? form}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>CNT type</span>
                  <input name="cnt_type" type="text" placeholder="SWCNT, DWCNT, MWCNT..." />
                </label>
                <label className="form-field">
                  <span>Synthesis</span>
                  <input name="synthesis_method" type="text" placeholder="Wet-spun, FCCVD, array-spun..." />
                </label>
                <label className="form-field form-field-wide">
                  <span>Postprocessing</span>
                  <input name="postprocessing" type="text" placeholder="Densified, iodine doped, drawn, annealed..." />
                </label>
              </section>

              <section>
                <div className="rail-heading">Measurements</div>
                {atlasData.properties.map((property) => (
                  <label key={property.key} className="form-field">
                    <span>{property.label}</span>
                    <input name={`measurement_${property.key}`} type="text" inputMode="decimal" placeholder={property.displayUnit} />
                  </label>
                ))}
              </section>

              <section>
                <div className="rail-heading">Measurement conditions</div>
                <label className="form-field">
                  <span>Temperature</span>
                  <input name="temperature_C" type="text" inputMode="decimal" placeholder="°C" />
                </label>
                <label className="form-field">
                  <span>Atmosphere</span>
                  <input name="atmosphere" type="text" placeholder="Air, vacuum, inert..." />
                </label>
                <label className="form-field form-field-wide">
                  <span>Method</span>
                  <input name="measurement_method" type="text" placeholder="4-probe, tensile test, laser flash..." />
                </label>
                <label className="form-field">
                  <span>Gauge length</span>
                  <input name="gauge_length_mm" type="text" inputMode="decimal" placeholder="mm" />
                </label>
                <label className="form-field">
                  <span>Strain rate</span>
                  <input name="strain_rate_s_inv" type="text" inputMode="decimal" placeholder="s⁻¹" />
                </label>
              </section>

              <section>
                <div className="rail-heading">Provenance</div>
                <label className="form-field form-field-wide">
                  <span>Table / figure / page</span>
                  <input name="provenance" type="text" placeholder="Fig. 2, Table S1, p. 538..." />
                </label>
                <label className="form-field form-field-wide">
                  <span>Notes</span>
                  <textarea name="notes" rows={3} placeholder="Measurement method, atmosphere, temperature, gauge length, caveats..." />
                </label>
              </section>

              <div className="submit-actions">
                <button className="citation-button" type="submit" disabled={submittingData}>
                  <Send size={14} strokeWidth={1.8} />
                  {submittingData ? "Checking DOI" : "Submit and plot"}
                </button>
                {submissionPacket ? (
                  <button className="copy-button" type="button" onClick={() => copyCitation("submission", submissionPacket)}>
                    {copiedCitation === "submission" ? <Check size={14} /> : <Clipboard size={14} />}
                    {copiedCitation === "submission" ? "Copied" : "Copy JSON"}
                  </button>
                ) : null}
              </div>

              {submissionPacket ? <pre className="submit-output">{submissionPacket}</pre> : null}
            </form>
          </div>
        </div>
      ) : null}
      <footer className="atlas-footer">
        <div className="footer-left">
          <strong>Carbon Nanotubes Property Atlas</strong>
          <span>Boies Group, Stanford University v0.1</span>
          <span>Please cite Sharma, G. & Boies, A. M. CNT Property Atlas, version 0.1 (2026), if you utilize information from this tool.</span>
        </div>
        <div className="footer-right">
          <strong>Database contains {atlasData.summary.recordCount} public records</strong>
          <span>
            Research: {atlasData.summary.peerReviewedResearchRecords} / DOI comparators: {atlasData.summary.peerReviewedComparatorRecords} / commercial: {atlasData.summary.commercialComparatorRecords}
          </span>
          <span>Secondary-extracted values: {atlasData.summary.secondaryExtractedRecords}</span>
        </div>
      </footer>
    </main>
  );
}
