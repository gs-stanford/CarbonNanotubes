"use client";

import { ArrowLeftRight, Check, Clipboard, Download, ExternalLink, FileText, Image as ImageIcon, Quote, RefreshCcw, Search, Send, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type MouseEvent, useEffect, useMemo, useState } from "react";
import { formatAtlasBibtex, formatAtlasCitation, stripMarkup } from "@/lib/citations";
import type { ExplorerBootstrap, FigureRequest, FigureResponse, FigureTopPoint } from "@/lib/figure-api";
import type { PlotRecord, PropertyKey, PropertyMeta, ScaleMode } from "@/lib/data";

type PlotType = "scatter" | "ranked" | "trend" | "ashby";
type NumericFilterKey = "density" | "diameter" | "gauge_length_mm" | "temperature_C";
type NumericFilterState = Record<NumericFilterKey, { min: string; max: string }>;

type SearchResult = {
  key: string;
  record_ids: string[];
  score: number;
  matchFields: string[];
  title: string | null;
  sample: string | null;
  doi: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  material_families: string[];
  form_factors: string[];
  matched_rows: number;
};

const PLOT_TYPES: Array<{ key: PlotType; label: string }> = [
  { key: "scatter", label: "Scatter" },
  { key: "ranked", label: "Highest reported" },
  { key: "trend", label: "Trend" },
  { key: "ashby", label: "Ashby" }
];

const TIER_OPTIONS = [
  { key: "peer_reviewed_research", label: "Peer-reviewed research", defaultOn: true },
  { key: "peer_reviewed_contextual_comparator", label: "Peer-reviewed comparators", defaultOn: true },
  { key: "commercial_contextual_comparator", label: "Commercial/spec-sheet", defaultOn: false }
];

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

const RANKED_FAMILIES = new Set(["carbon_fiber_comparator", "CNT_or_CNT_hybrid", "CNT_metal_composite", "graphene_or_GO_fiber"]);
const NORMALIZED_KEYS = new Set<PropertyKey>(["density", "specific_volume", "specific_strength", "specific_modulus", "specific_electrical_conductivity", "specific_thermal_conductivity"]);
const MASS_SPECIFIC_KEYS = new Set<PropertyKey>(["specific_strength", "specific_modulus", "specific_electrical_conductivity", "specific_thermal_conductivity"]);

const NUMERIC_FILTERS: Array<{ key: NumericFilterKey; label: string; unit: string }> = [
  { key: "density", label: "Density", unit: "kg m⁻³" },
  { key: "diameter", label: "Diameter", unit: "µm" },
  { key: "gauge_length_mm", label: "Gauge length", unit: "mm" },
  { key: "temperature_C", label: "Temperature", unit: "°C" }
];

function emptyNumericFilters(): NumericFilterState {
  return {
    density: { min: "", max: "" },
    diameter: { min: "", max: "" },
    gauge_length_mm: { min: "", max: "" },
    temperature_C: { min: "", max: "" }
  };
}

function numeric(value: string): number | null {
  const parsed = Number(value.replace(/,/g, "").trim());
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

function metaFor(properties: PropertyMeta[], key: PropertyKey): PropertyMeta {
  const found = properties.find((property) => property.key === key);
  if (!found) throw new Error(`Property ${key} is unavailable.`);
  return found;
}

function toggle<T extends string>(value: T, current: Set<T>, setter: (next: Set<T>) => void) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function doiHref(doi: string | null | undefined): string | null {
  const clean = (doi ?? "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").trim();
  return clean ? `https://doi.org/${clean}` : null;
}

function displayValue(value: number, meta: PropertyMeta): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: meta.precision, maximumSignificantDigits: 5 })} ${meta.displayUnit}`;
}

function titleFor(record: PlotRecord): string {
  return stripMarkup(record.publication_title_verified || record.citation_raw || record.public_sample_label || record.record_label);
}

function sampleSummary(record: PlotRecord): string {
  return [record.public_sample_label, FAMILY_LABELS[record.material_family] ?? record.material_family, FORM_LABELS[record.form_factor] ?? record.form_factor, record.cnt_type]
    .filter(Boolean)
    .join(" / ");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function decodeBase64(value: string, type: string): Blob {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function topCsv(rows: FigureTopPoint[]): string {
  const keys: Array<keyof FigureTopPoint> = ["rank", "label", "material_family", "form_factor", "x_value", "x_unit", "y_value", "y_unit", "doi", "publication_title", "publication_year", "citation"];
  return [keys.join(","), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(","))].join("\n");
}

function figureFilename(kind: PlotType, x: PropertyKey, y: PropertyKey, extension: string): string {
  return `carbon-property-tables-${kind}-${x}-vs-${y}.${extension}`;
}

export function BoundedPropertyExplorer({ initialData }: { initialData: ExplorerBootstrap }) {
  const properties = initialData.properties;
  const families = initialData.families;
  const forms = initialData.forms;
  const initialYearMin = Math.max(1991, initialData.summary.minYear ?? 1991);
  const initialYearMax = initialData.summary.maxYear ?? new Date().getFullYear();
  const [xKey, setXKey] = useState<PropertyKey>("specific_strength");
  const [yKey, setYKey] = useState<PropertyKey>("specific_electrical_conductivity");
  const [xScale, setXScale] = useState<ScaleMode>("linear");
  const [yScale, setYScale] = useState<ScaleMode>("linear");
  const [plotType, setPlotType] = useState<PlotType>("scatter");
  const [selectedTiers, setSelectedTiers] = useState(() => new Set(TIER_OPTIONS.filter((item) => item.defaultOn).map((item) => item.key)));
  const [selectedFamilies, setSelectedFamilies] = useState(() => new Set(families));
  const [selectedForms, setSelectedForms] = useState(() => new Set(forms));
  const [yearMin, setYearMin] = useState(initialYearMin);
  const [yearMax, setYearMax] = useState(initialYearMax);
  const [numericFilters, setNumericFilters] = useState<NumericFilterState>(() => emptyNumericFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [figure, setFigure] = useState<FigureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [figureError, setFigureError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [citationOpen, setCitationOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [submissionPacket, setSubmissionPacket] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const numericFiltersActive = Object.values(numericFilters).some((bounds) => bounds.min.trim() || bounds.max.trim());

  const xMeta = metaFor(properties, xKey);
  const yMeta = metaFor(properties, yKey);
  const isXy = plotType === "scatter" || plotType === "ashby";
  const xEffective: ScaleMode = plotType === "ashby" ? "log" : xScale;
  const yEffective: ScaleMode = plotType === "ashby" ? "log" : yScale;
  const normalized = isXy ? NORMALIZED_KEYS.has(xKey) && NORMALIZED_KEYS.has(yKey) : NORMALIZED_KEYS.has(yKey);
  const plottedIds = useMemo(() => new Set(figure?.record_ids ?? []), [figure?.record_ids]);
  const highlightedIds = useMemo(
    () => searchResults.flatMap((result) => result.record_ids),
    [searchResults]
  );

  const filters = useMemo<Record<string, unknown>>(() => {
    const output: Record<string, unknown> = {
      release_tier: [...selectedTiers],
      material_family: [...selectedFamilies],
      form_factor: [...selectedForms],
      year_min: yearMin,
      year_max: yearMax
    };
    if (normalized) output.normalized_eligible = true;
    const measurementFilters: string[] = [];
    for (const key of ["density", "diameter"] as const) {
      const minRaw = numeric(numericFilters[key].min);
      const maxRaw = numeric(numericFilters[key].max);
      if (minRaw === null && maxRaw === null) continue;
      const factor = key === "diameter" ? 1e-6 : 1;
      measurementFilters.push(`${key}:${minRaw === null ? "" : minRaw * factor}:${maxRaw === null ? "" : maxRaw * factor}`);
    }
    if (measurementFilters.length) output.measurement_filter = measurementFilters;
    const gaugeMin = numeric(numericFilters.gauge_length_mm.min);
    const gaugeMax = numeric(numericFilters.gauge_length_mm.max);
    const temperatureMin = numeric(numericFilters.temperature_C.min);
    const temperatureMax = numeric(numericFilters.temperature_C.max);
    if (gaugeMin !== null) output.gauge_length_min_mm = gaugeMin;
    if (gaugeMax !== null) output.gauge_length_max_mm = gaugeMax;
    if (temperatureMin !== null) output.temperature_min_c = temperatureMin;
    if (temperatureMax !== null) output.temperature_max_c = temperatureMax;
    return output;
  }, [normalized, numericFilters, selectedFamilies, selectedForms, selectedTiers, yearMax, yearMin]);

  const requestBody = useMemo<FigureRequest>(() => ({
    kind: plotType,
    x: xKey,
    y: yKey,
    x_scale: xEffective,
    y_scale: yEffective,
    selected_record_id: selectedId,
    highlight_record_ids: highlightedIds,
    formats: ["svg"],
    top: 0,
    comparison_grades: ["A", "B", "C", "D"],
    filters
  }), [filters, highlightedIds, plotType, selectedId, xEffective, xKey, yEffective, yKey]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setFigureError(null);
      try {
        const response = await fetch("/api/v1/figures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || "Figure request failed.");
        setFigure(payload as FigureResponse);
      } catch (error) {
        if (!controller.signal.aborted) setFigureError(error instanceof Error ? error.message : "Figure request failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 80);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [requestBody]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12`, { signal: controller.signal });
        const payload = await response.json();
        if (response.ok) setSearchResults(Array.isArray(payload.results) ? payload.results : []);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  const selectedRecord = figure?.selected_record ?? null;
  const counts = figure?.counts;
  const figureTitle = plotType === "trend"
    ? `${yMeta.label} by publication year`
    : plotType === "ranked"
      ? `Highest reported values: ${yMeta.label}`
      : `${plotType === "ashby" ? "Ashby plot: " : ""}${yMeta.label} vs ${xMeta.label}`;
  const detailKeys = selectedRecord
    ? Array.from(new Set<PropertyKey>([xKey, yKey, "density", "diameter", "electrical_conductivity", "ampacity"])).filter((key) => typeof selectedRecord.values[key] === "number")
    : [];
  const selectedCitation = selectedRecord
    ? figure?.citations.entries.find((entry) => entry.record_ids.includes(selectedRecord.record_id) && entry.roles.includes("original"))?.text ?? ""
    : "";
  const lowDensityBasis = Boolean(selectedRecord
    && selectedRecord.material_family === "CNT_or_CNT_hybrid"
    && selectedRecord.form_factor === "fiber_yarn"
    && (selectedRecord.values.density ?? Infinity) < 600
    && (typeof selectedRecord.values.specific_strength === "number" || typeof selectedRecord.values.specific_electrical_conductivity === "number"));

  function reset() {
    setXKey("specific_strength");
    setYKey("specific_electrical_conductivity");
    setXScale("linear");
    setYScale("linear");
    setPlotType("scatter");
    setSelectedTiers(new Set(TIER_OPTIONS.filter((item) => item.defaultOn).map((item) => item.key)));
    setSelectedFamilies(new Set(families));
    setSelectedForms(new Set(forms));
    setYearMin(initialYearMin);
    setYearMax(initialYearMax);
    setNumericFilters(emptyNumericFilters());
    setSelectedId(null);
    setSearchQuery("");
  }

  function selectFromSvg(target: EventTarget | null) {
    const element = target instanceof Element ? target.closest<SVGElement>("[data-record-id]") : null;
    const recordId = element?.getAttribute("data-record-id");
    if (recordId) setSelectedId(recordId);
  }

  async function requestExport(format: "svg" | "png" | "pdf" | "csv") {
    setExporting(format);
    try {
      const response = await fetch("/api/v1/figures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, highlight_record_ids: [], selected_record_id: null, formats: format === "csv" ? ["svg"] : [format], top: format === "csv" ? 10 : 0 })
      });
      const payload = await response.json() as FigureResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Export failed.");
      if (format === "svg" && payload.images.svg) downloadBlob(figureFilename(plotType, xKey, yKey, "svg"), new Blob([payload.images.svg], { type: "image/svg+xml;charset=utf-8" }));
      if (format === "png" && payload.images.png_base64) downloadBlob(figureFilename(plotType, xKey, yKey, "png"), decodeBase64(payload.images.png_base64, "image/png"));
      if (format === "pdf" && payload.images.pdf_base64) downloadBlob(figureFilename(plotType, xKey, yKey, "pdf"), decodeBase64(payload.images.pdf_base64, "application/pdf"));
      if (format === "csv") downloadBlob(figureFilename(plotType, xKey, yKey, "top-10.csv"), new Blob([topCsv(payload.top_points)], { type: "text/csv;charset=utf-8" }));
      const citations = `${payload.citations.copy_all}\n\nBibTeX:\n${payload.citations.bibtex}\n`;
      downloadBlob(figureFilename(plotType, xKey, yKey, "citations.txt"), new Blob([citations], { type: "text/plain;charset=utf-8" }));
    } catch (error) {
      setFigureError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  async function copyCitations() {
    await navigator.clipboard.writeText(figure?.citations.copy_all ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function submitData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const packet = {
      schema_version: "carbon-property-tables-submission-v0.2",
      created_at: new Date().toISOString(),
      publication: { doi: String(data.get("doi") ?? "").trim(), title: String(data.get("title") ?? "").trim(), year: String(data.get("year") ?? "").trim() },
      sample: {
        sample_label: String(data.get("sample_label") ?? "").trim(),
        material_family: String(data.get("material_family") ?? "").trim(),
        form_factor: String(data.get("form_factor") ?? "").trim(),
        cnt_type: String(data.get("cnt_type") ?? "").trim(),
        synthesis_method: String(data.get("synthesis_method") ?? "").trim(),
        postprocessing: String(data.get("postprocessing") ?? "").trim(),
        specimen_id: String(data.get("specimen_id") ?? "").trim(),
        sample_batch_id: String(data.get("sample_batch_id") ?? "").trim(),
        specimen_linkage: String(data.get("specimen_linkage") ?? "").trim(),
        density_basis: String(data.get("density_basis") ?? "").trim(),
        cross_section_method: String(data.get("cross_section_method") ?? "").trim()
      },
      measurements: Object.fromEntries(properties.map((property) => [property.key, {
        value: String(data.get(`measurement_${property.key}`) ?? "").trim(),
        uncertainty_value: String(data.get(`uncertainty_${property.key}`) ?? "").trim(),
        uncertainty_type: String(data.get(`uncertainty_type_${property.key}`) ?? "").trim(),
        statistic_type: String(data.get(`statistic_${property.key}`) ?? "").trim(),
        sample_size_n: String(data.get(`sample_size_${property.key}`) ?? "").trim(),
        value_bound_type: String(data.get(`bound_${property.key}`) ?? "").trim(),
        normalization_basis: String(data.get(`normalization_${property.key}`) ?? "").trim()
      }])),
      conditions: {
        temperature_C: String(data.get("temperature_C") ?? "").trim(), atmosphere: String(data.get("atmosphere") ?? "").trim(),
        measurement_method: String(data.get("measurement_method") ?? "").trim(), gauge_length_mm: String(data.get("gauge_length_mm") ?? "").trim(),
        strain_rate_s_inv: String(data.get("strain_rate_s_inv") ?? "").trim(), test_standard: String(data.get("test_standard") ?? "").trim(),
        measurement_direction: String(data.get("measurement_direction") ?? "").trim()
      },
      provenance: {
        table_figure_page: String(data.get("provenance") ?? "").trim(),
        extraction_method: "submitter_entered_from_source",
        notes: String(data.get("notes") ?? "").trim()
      }
    };
    setSubmitting(true);
    try {
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(packet) });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.record?.record_id) {
        setSubmissionPacket(JSON.stringify({ status: "rejected", response: result }, null, 2));
        return;
      }
      setSubmissionPacket(JSON.stringify({
        status: "accepted_pending_curator_review",
        submission_id: result.submissionId,
        record_id: result.record.record_id,
        public_visible: false,
        checks: result.checks,
        doi: result.record.doi_verified
      }, null, 2));
      form.reset();
    } catch {
      setSubmissionPacket(JSON.stringify({ status: "failed", error: "Network or server error during submission." }, null, 2));
    } finally {
      setSubmitting(false);
    }
  }

  const visibleSearchCount = searchResults.filter((result) => result.record_ids.some((id) => plottedIds.has(id))).length;
  const familyOptions = plotType === "ranked" ? families.filter((family) => RANKED_FAMILIES.has(family)) : families;

  return (
    <main className="atlas-shell">
      <header className="atlas-header">
        <div className="brand-block"><h1>Carbon Property Tables</h1></div>
        <nav className="header-nav" aria-label="Atlas sections"><button type="button" onClick={() => setCitationOpen(true)}>How to cite</button></nav>
        <div className="header-actions">
          <button className="header-action-link" type="button" onClick={() => setSubmitOpen(true)}><Send size={16}/><span>Submit data</span></button>
          <button className="header-action-link header-action-primary" type="button" onClick={() => setExportOpen(true)}><Download size={18}/><span>Download Figure</span></button>
          <button className="header-action-link" type="button" onClick={reset}><RefreshCcw size={16}/><span>Reset</span></button>
        </div>
      </header>

      <div className="atlas-workspace">
        <aside className="control-rail" aria-label="Plot controls">
          <section className="rail-section axis-section">
            <div className="rail-heading">Plot setup</div>
            {isXy ? <>
              <label className="field-label" htmlFor="x-property">X property</label>
              <select id="x-property" value={xKey} onChange={(event) => { setXKey(event.target.value as PropertyKey); setSelectedId(null); }}>
                {properties.map((property) => <option key={property.key} value={property.key}>{property.label}</option>)}
              </select>
              <p className="unit-hint">({xMeta.displayUnit})</p>
              <div className="scale-row">
                <button className={xEffective === "linear" ? "segmented is-active" : "segmented"} disabled={plotType === "ashby"} onClick={() => setXScale("linear")}>Linear</button>
                <button className={xEffective === "log" ? "segmented is-active" : "segmented"} disabled={plotType === "ashby"} onClick={() => setXScale("log")}>Log</button>
              </div>
              <button className="swap-button" type="button" title="Swap axes" onClick={() => { const oldX = xKey; setXKey(yKey); setYKey(oldX); setXScale(yScale); setYScale(xScale); setSelectedId(null); }}><ArrowLeftRight size={15}/></button>
            </> : null}
            <label className="field-label" htmlFor="y-property">{isXy ? "Y property" : "Property"}</label>
            <select id="y-property" value={yKey} onChange={(event) => { setYKey(event.target.value as PropertyKey); setSelectedId(null); }}>
              {properties.map((property) => <option key={property.key} value={property.key}>{property.label}</option>)}
            </select>
            <p className="unit-hint">({yMeta.displayUnit})</p>
            <div className="scale-row">
              <button className={yEffective === "linear" ? "segmented is-active" : "segmented"} disabled={plotType === "ashby"} onClick={() => setYScale("linear")}>Linear</button>
              <button className={yEffective === "log" ? "segmented is-active" : "segmented"} disabled={plotType === "ashby"} onClick={() => setYScale("log")}>Log</button>
            </div>
          </section>

          <section className="rail-section"><div className="rail-heading">Source class</div>
            {TIER_OPTIONS.map((item) => <label className="check-row" key={item.key}><input type="checkbox" checked={selectedTiers.has(item.key)} onChange={() => toggle(item.key, selectedTiers, setSelectedTiers)}/><span>{item.label}</span><span className="count">{counts?.release_tiers[item.key] ?? 0}</span></label>)}
          </section>
          <section className="rail-section"><div className="rail-heading">Material family</div>
            {familyOptions.map((family) => <label className="check-row compact family-check-row" key={family}><input type="checkbox" checked={selectedFamilies.has(family)} onChange={() => toggle(family, selectedFamilies, setSelectedFamilies)}/><i className={`material-swatch ${MATERIAL_CLASS[family] ?? "material-unknown"}`}/><span>{FAMILY_LABELS[family] ?? family}</span><span className="count">{counts?.material_families[family] ?? 0}</span></label>)}
          </section>
          <section className="rail-section"><div className="rail-heading">Form factor</div>
            {forms.map((form) => <label className="check-row compact family-check-row" key={form}><input type="checkbox" checked={selectedForms.has(form)} onChange={() => toggle(form, selectedForms, setSelectedForms)}/><i className={`shape-swatch ${FORM_SHAPE_CLASS[form] ?? "shape-open-circle"}`}/><span>{FORM_LABELS[form] ?? form}</span><span className="count">{counts?.form_factors[form] ?? 0}</span></label>)}
          </section>
          <section className="rail-section"><div className="rail-heading">Year</div><div className="year-row"><input type="number" value={yearMin} onChange={(event) => setYearMin(Number(event.target.value))}/><span>to</span><input type="number" value={yearMax} onChange={(event) => setYearMax(Number(event.target.value))}/></div></section>
          <section className="rail-section"><div className="rail-heading">Numeric filters{numericFiltersActive ? <span className="rail-heading-note">active</span> : null}</div><div className="numeric-filter-grid">
            {NUMERIC_FILTERS.map((item) => <div className="numeric-filter-row" key={item.key}><div><span>{item.label}</span><small>{item.unit}</small></div><input type="number" aria-label={`Minimum ${item.label}`} placeholder="min" value={numericFilters[item.key].min} onChange={(event) => setNumericFilters((current) => ({ ...current, [item.key]: { ...current[item.key], min: event.target.value } }))}/><input type="number" aria-label={`Maximum ${item.label}`} placeholder="max" value={numericFilters[item.key].max} onChange={(event) => setNumericFilters((current) => ({ ...current, [item.key]: { ...current[item.key], max: event.target.value } }))}/></div>)}
          </div><p className="filter-note">A numeric filter includes only records reporting that field.</p></section>
        </aside>

        <section className="plot-panel" aria-label="Property plot">
          <div className="plot-title-row">
            <div className="plot-search-bar" role="search"><div className="search-input-shell"><Search size={15}/><input type="search" aria-label="Search records by DOI, author, title, or keyword" value={searchQuery} placeholder="Search DOI, authors, title, keyword" onChange={(event) => setSearchQuery(event.target.value)}/>{searchQuery ? <button onClick={() => setSearchQuery("")} aria-label="Clear search"><X size={13}/></button> : null}</div>{searching || searchQuery.trim() ? <p className="plot-search-status">{searching ? "Searching…" : `${searchResults.length} publications found; ${visibleSearchCount} represented in the active plot.`}</p> : null}</div>
            <div className="plot-heading"><h2>{figureTitle}</h2><p>Watermark is removed from exported files. Every download includes the active citation set.</p></div>
            <div className="plot-toolbar"><div className="plot-type-tabs" role="tablist">{PLOT_TYPES.map((item) => <button key={item.key} className={plotType === item.key ? "mode-button is-active" : "mode-button"} role="tab" aria-selected={plotType === item.key} onClick={() => { setPlotType(item.key); if (item.key === "ashby") { setXScale("log"); setYScale("log"); } setSelectedId(null); }}>{item.label}</button>)}</div></div>
          </div>

          {searchQuery.trim() ? <div className="plot-search-results"><div className="plot-search-results-heading"><span>Search results</span><strong>{searchResults.length} publications / {visibleSearchCount} in active plot</strong></div>{searchResults.length ? <div className="plot-search-result-grid">{searchResults.map((result) => {
            const visibleId = result.record_ids.find((id) => plottedIds.has(id));
            return <button key={result.key} className={visibleId ? "plot-search-result-card is-in-plot" : "plot-search-result-card is-out-of-plot"} disabled={!visibleId} onClick={() => visibleId && setSelectedId(visibleId)}><strong>{result.title || result.sample || result.doi || "Untitled publication"}</strong><span>{result.authors || "Unknown authors"} / {result.year ?? "n.d."}</span><small>{visibleId ? "highlight in figure" : "outside active figure"}{result.matched_rows > 1 ? ` / ${result.matched_rows} samples` : ""}</small></button>;
          })}</div> : <p className="plot-search-empty">No publication matches this query.</p>}</div> : null}

          <figure className="plot-figure bounded-figure" aria-busy={loading} onClick={(event: MouseEvent<HTMLElement>) => selectFromSvg(event.target)} onKeyDown={(event: KeyboardEvent<HTMLElement>) => { if (event.key === "Enter" || event.key === " ") selectFromSvg(event.target); }}>
            {figure?.display_svg ? <div className="server-figure-svg" dangerouslySetInnerHTML={{ __html: figure.display_svg }}/>: null}
            {loading ? <div className="figure-status">Rendering figure…</div> : null}
            {figureError ? <div className="figure-error">{figureError}</div> : null}
          </figure>
        </section>

        <aside className="detail-rail" aria-label="Focused record">
          <section className="detail-section"><div className="rail-heading">Selected point</div>{selectedRecord ? <><h3>{titleFor(selectedRecord)}</h3><p className="detail-meta">{sampleSummary(selectedRecord)}</p><div className="badge-line"><span className={`tier-badge ${selectedRecord.contextual_benchmark ? "context" : "primary"}`}>{selectedRecord.public_plot_badge}</span>{lowDensityBasis ? <span className="tier-badge warning">low-density basis</span> : null}{selectedRecord.missing_conditions ? <span className="tier-badge warning">missing conditions</span> : null}</div><dl className="metric-list">{detailKeys.map((key) => { const meta = metaFor(properties, key); return <div key={key}><dt>{meta.label}</dt><dd>{displayValue(selectedRecord.values[key] as number, meta)}</dd></div>; })}</dl></> : <p className="detail-meta">Select a plotted marker to inspect its source and reported conditions.</p>}</section>
          {selectedRecord ? <><section className="detail-section"><div className="rail-heading">Source</div><p className="source-title">{titleFor(selectedRecord)}</p><p className="detail-meta">{selectedRecord.publication_authors_short_verified || "Authors unavailable"}</p><p className="detail-meta">{[selectedRecord.publication_journal_verified, selectedRecord.publication_year_verified].filter(Boolean).join(" / ")}</p>{doiHref(selectedRecord.doi_verified || selectedRecord.doi_raw) ? <a className="doi-link" href={doiHref(selectedRecord.doi_verified || selectedRecord.doi_raw) ?? undefined} target="_blank" rel="noreferrer">{selectedRecord.doi_verified || selectedRecord.doi_raw}<ExternalLink size={11}/></a> : <p className="doi-line">Source identifier pending</p>}</section>
          <section className="detail-section"><div className="rail-heading">Measurement conditions</div><dl className="detail-table"><div><dt>Temperature</dt><dd>{selectedRecord.condition_temperature_C !== null ? `${selectedRecord.condition_temperature_C} °C` : "-"}</dd></div><div><dt>Atmosphere</dt><dd>{selectedRecord.condition_atmosphere || "-"}</dd></div><div><dt>Method</dt><dd>{selectedRecord.measurement_method || "-"}</dd></div><div><dt>Gauge length</dt><dd>{selectedRecord.gauge_length_mm !== null ? `${selectedRecord.gauge_length_mm} mm` : "-"}</dd></div><div><dt>Strain rate</dt><dd>{selectedRecord.strain_rate_s_inv !== null ? `${selectedRecord.strain_rate_s_inv} s⁻¹` : "-"}</dd></div></dl></section>
          {lowDensityBasis ? <section className="detail-section"><div className="rail-heading">Comparison note</div><p className="caveat-text">Specific properties are mass-normalized. This low-density porous fiber may rank highly while retaining a substantial volumetric-performance penalty.</p></section> : null}
          <section className="detail-section"><div className="rail-heading">Citation</div><p className="citation-preview">{selectedCitation}</p><button className="citation-button" onClick={() => setCitationOpen(true)}><Quote size={14}/>Open citation tool</button></section></> : null}
        </aside>
      </div>

      <footer className="atlas-footer">Designed by Boies Group, Stanford University</footer>

      {citationOpen ? <div className="citation-modal" role="dialog" aria-modal="true" aria-labelledby="citation-dialog-title"><div className="citation-card citation-card-wide"><div className="citation-card-header"><div><p className="plot-kicker">Citation tool</p><h2 id="citation-dialog-title">Citations for the current figure</h2></div><button className="icon-button" aria-label="Close citation tool" onClick={() => setCitationOpen(false)}><X/></button></div><div className="citation-list"><section><div className="rail-heading">Active citation set</div><p>{figure?.point_count ?? 0} plotted representative records. Copying returns one unified citation list.</p><button className="copy-button" onClick={copyCitations}>{copied ? <Check size={14}/> : <Clipboard size={14}/>} {copied ? "Copied" : "Copy all citations"}</button></section><section><div className="rail-heading">Publications</div><ol className="citation-source-list">{figure?.citations.entries.filter((entry) => !entry.roles.includes("atlas")).map((entry) => <li key={entry.citation_id}>{entry.text}</li>)}</ol></section><section><div className="rail-heading">Carbon Property Tables</div><p>{formatAtlasCitation()}</p></section><section className="bibtex-section"><div className="rail-heading">BibTeX</div><pre>{figure?.citations.bibtex || formatAtlasBibtex()}</pre></section></div></div></div> : null}

      {exportOpen ? <div className="citation-modal" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title"><div className="citation-card export-card"><div className="citation-card-header"><div><p className="plot-kicker">Figure export</p><h2 id="export-dialog-title">Download figure and citations</h2></div><button className="icon-button" aria-label="Close export" onClick={() => setExportOpen(false)}><X/></button></div><div className="export-list"><button className="export-option" aria-label="Download SVG" disabled={Boolean(exporting)} onClick={() => requestExport("svg")}><FileText/><span><strong>SVG</strong><small>Editable vector artwork with publication legend; no selection halo or watermark.</small></span></button><button className="export-option" aria-label="Download PDF" disabled={Boolean(exporting)} onClick={() => requestExport("pdf")}><FileText/><span><strong>PDF</strong><small>Publication-ready page with bundled citation sidecar.</small></span></button><button className="export-option" aria-label="Download PNG" disabled={Boolean(exporting)} onClick={() => requestExport("png")}><ImageIcon/><span><strong>PNG</strong><small>High-resolution raster output with bundled citation sidecar.</small></span></button><button className="export-option" aria-label="Download top 10 table" disabled={Boolean(exporting)} onClick={() => requestExport("csv")}><Download/><span><strong>Top 10 table</strong><small>Capped high-performance rows only; the full canonical table is not exported.</small></span></button></div></div></div> : null}

      {submitOpen ? <div className="citation-modal" role="dialog" aria-modal="true" aria-labelledby="submit-dialog-title"><div className="citation-card submit-card">
        <div className="citation-card-header"><div><p className="plot-kicker">Community contribution</p><h2 id="submit-dialog-title">Submit data for curator review</h2></div><button className="icon-button" aria-label="Close submit data" onClick={() => setSubmitOpen(false)}><X/></button></div>
        <form className="submit-form" onSubmit={submitData}>
          <section><div className="rail-heading">Publication</div><label className="form-field"><span>DOI *</span><input name="doi" required/></label></section>
          <section><div className="rail-heading">Sample identity</div>
            <label className="form-field form-field-wide"><span>Sample label *</span><input name="sample_label" required/></label>
            <label className="form-field"><span>Material family *</span><select name="material_family" required>{families.map((family) => <option key={family} value={family}>{FAMILY_LABELS[family] ?? family}</option>)}</select></label>
            <label className="form-field"><span>Form factor *</span><select name="form_factor" required>{forms.map((form) => <option key={form} value={form}>{FORM_LABELS[form] ?? form}</option>)}</select></label>
            <label className="form-field"><span>CNT type</span><input name="cnt_type"/></label>
            <label className="form-field"><span>Synthesis method</span><input name="synthesis_method"/></label>
            <label className="form-field form-field-wide"><span>Postprocessing</span><input name="postprocessing"/></label>
            <label className="form-field"><span>Specimen ID</span><input name="specimen_id"/></label>
            <label className="form-field"><span>Sample batch ID</span><input name="sample_batch_id"/></label>
            <label className="form-field"><span>Property linkage *</span><select name="specimen_linkage" required defaultValue="unknown"><option value="same_specimen_submitter_claimed">Same specimen</option><option value="same_sample_batch_submitter_claimed">Same sample batch</option><option value="mixed_specimens">Different specimens</option><option value="unknown">Not established</option></select></label>
            <label className="form-field"><span>Density basis</span><select name="density_basis" defaultValue="unknown"><option value="unknown">Not reported</option><option value="bulk_envelope">Bulk / envelope</option><option value="skeletal_pycnometry">Skeletal / pycnometry</option><option value="assumed_graphitic">Assumed graphitic</option><option value="linear_density_cross_section">Linear density + cross-section</option><option value="other_reported">Other reported basis</option></select></label>
            <label className="form-field form-field-wide"><span>Cross-section method</span><input name="cross_section_method"/></label>
          </section>
          <section className="submission-measurements"><div className="rail-heading">Measurements</div>{properties.map((property) => <div className="submission-measurement-row" key={property.key}>
            <div className="submission-measurement-name"><strong>{property.label}</strong><span>{property.displayUnit}</span></div>
            <label><span>Value</span><input name={`measurement_${property.key}`} type="number" step="any" min="0"/></label>
            <label><span>Statistic</span><select name={`statistic_${property.key}`} defaultValue="unspecified"><option value="unspecified">Unspecified</option><option value="individual">Individual</option><option value="mean">Mean</option><option value="median">Median</option><option value="best_specimen">Best specimen</option><option value="maximum">Maximum</option><option value="minimum">Minimum</option><option value="range_endpoint">Range endpoint</option></select></label>
            <label><span>Uncertainty</span><input name={`uncertainty_${property.key}`} type="number" step="any" min="0"/></label>
            <label><span>Uncertainty type</span><select name={`uncertainty_type_${property.key}`} defaultValue="not_reported"><option value="not_reported">Not reported</option><option value="standard_deviation">SD</option><option value="standard_error">SE</option><option value="confidence_interval">Confidence interval</option><option value="range">Range</option><option value="reported_unspecified">Unspecified error</option></select></label>
            <label><span>n</span><input name={`sample_size_${property.key}`} type="number" step="1" min="1"/></label>
            <label><span>Value type</span><select name={`bound_${property.key}`} defaultValue="unspecified"><option value="unspecified">Unspecified</option><option value="point_estimate">Point estimate</option><option value="upper_bound">Upper bound / up to</option><option value="lower_bound">Lower bound</option><option value="range_midpoint">Range midpoint</option><option value="range_endpoint">Range endpoint</option></select></label>
            {MASS_SPECIFIC_KEYS.has(property.key) ? <label><span>Normalization</span><select name={`normalization_${property.key}`} defaultValue="unknown"><option value="unknown">Not established</option><option value="direct_mass_specific_linear_density">Force / linear density</option><option value="directly_reported_mass_specific">Direct mass-specific</option><option value="derived_from_density">Derived from density</option><option value="derived_from_linear_density">Derived from linear density</option></select></label> : <input type="hidden" name={`normalization_${property.key}`} value="not_applicable"/>}
          </div>)}</section>
          <section><div className="rail-heading">Conditions and provenance</div>
            <label className="form-field"><span>Temperature (°C)</span><input name="temperature_C" type="number" step="any"/></label>
            <label className="form-field"><span>Atmosphere</span><input name="atmosphere"/></label>
            <label className="form-field"><span>Measurement method</span><input name="measurement_method"/></label>
            <label className="form-field"><span>Test standard</span><input name="test_standard"/></label>
            <label className="form-field"><span>Measurement direction</span><input name="measurement_direction"/></label>
            <label className="form-field"><span>Gauge length (mm)</span><input name="gauge_length_mm" type="number" step="any"/></label>
            <label className="form-field"><span>Strain rate (s⁻¹)</span><input name="strain_rate_s_inv" type="number" step="any"/></label>
            <label className="form-field"><span>Table / figure / page *</span><input name="provenance" required/></label>
            <label className="form-field form-field-wide"><span>Notes</span><textarea name="notes" rows={3}/></label>
          </section>
          <div className="submit-actions"><button className="citation-button" type="submit" disabled={submitting}><Send size={14}/>{submitting ? "Validating DOI" : "Submit for validation"}</button></div>
          {submissionPacket ? <pre className="submit-output">{submissionPacket}</pre> : null}
        </form>
      </div></div> : null}
    </main>
  );
}
