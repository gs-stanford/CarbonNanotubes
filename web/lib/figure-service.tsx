import { Resvg } from "@resvg/resvg-js";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { join } from "node:path";
import { citationBundleForRecords, stripMarkup, type CitationBundle } from "@/lib/citations";
import { apiMeta, ApiInputError, parseRecordQuery } from "@/lib/api-v1";
import { PROPERTY_BY_KEY, isPropertyKey, type PlotRecord, type PropertyKey, type ScaleMode } from "@/lib/data";
import type {
  FigureCounts,
  FigureFormat,
  FigureKind,
  FigureRequest,
  FigureResponse,
  FigureTopAxis,
  FigureTopPoint
} from "@/lib/figure-api";
import {
  defaultSelectedRecord,
  representativeRecords,
  temporaryRank,
  topRecords
} from "@/lib/representative";
import { getReleaseDescriptor, queryCanonicalRecords } from "@/lib/query-store";
import { renderSvgFigure, type FigureReferenceLine } from "@/lib/svg-renderer";
import {
  figureComparability,
  type ComparabilityGrade,
  type FigureComparability
} from "@/lib/comparability";

const FIGURE_WIDTH = 920;
const FIGURE_HEIGHT = 576;
const MAX_HIGHLIGHTS = 50;
const RASTER_FONT_FILES = [
  join(process.cwd(), "assets/fonts/Arimo-Regular.ttf"),
  join(process.cwd(), "assets/fonts/Arimo-Bold.ttf")
];

const ALLOWED_FILTERS = new Set([
  "q",
  "property",
  "min_value",
  "max_value",
  "measurement_filter",
  "material_family",
  "form_factor",
  "release_tier",
  "doi",
  "author",
  "journal",
  "year_min",
  "year_max",
  "gauge_length_min_mm",
  "gauge_length_max_mm",
  "temperature_min_c",
  "temperature_max_c",
  "provenance",
  "verification",
  "strict_ready",
  "peer_reviewed",
  "normalized_eligible"
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

const RANKED_REFERENCE_LINES: Partial<Record<PropertyKey, FigureReferenceLine[]>> = {
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

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiInputError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function stringChoice<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new ApiInputError(`${label} must be one of: ${choices.join(", ")}.`);
  }
  return value as T;
}

function propertyValue(value: unknown, label: string): PropertyKey {
  if (typeof value !== "string" || !isPropertyKey(value)) throw new ApiInputError(`${label} must be a valid property key.`);
  return value;
}

function filterSearchParams(value: unknown): URLSearchParams {
  if (value === undefined || value === null) return new URLSearchParams();
  const filters = objectValue(value, "filters");
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(key)) throw new ApiInputError(`Unsupported figure filter: ${key}.`);
    const values = Array.isArray(raw) ? raw : [raw];
    for (const item of values) {
      if (item === null || item === undefined || item === "") continue;
      if (!["string", "number", "boolean"].includes(typeof item)) {
        throw new ApiInputError(`Figure filter ${key} must contain scalar values.`);
      }
      params.append(key, String(item));
    }
  }
  return params;
}

function parseRequest(value: unknown): Required<Pick<FigureRequest, "kind" | "x" | "y">> & FigureRequest {
  const body = objectValue(value, "request body");
  const kind = stringChoice(body.kind, ["scatter", "ranked", "trend", "ashby"] as const, "kind");
  const x = propertyValue(body.x, "x");
  const y = propertyValue(body.y, "y");
  if (x === y && (kind === "scatter" || kind === "ashby")) throw new ApiInputError("x and y must be different properties.");
  const xScale = kind === "ashby"
    ? "log"
    : stringChoice(body.x_scale ?? "linear", ["linear", "log"] as const, "x_scale");
  const yScale = kind === "ashby"
    ? "log"
    : stringChoice(body.y_scale ?? "linear", ["linear", "log"] as const, "y_scale");
  const top = body.top === undefined ? 0 : Number(body.top);
  const topBy = stringChoice(body.top_by ?? "auto", ["auto", "x", "y"] as const, "top_by");
  const formats: FigureFormat[] = body.formats === undefined
    ? ["svg"]
    : Array.from(new Set((Array.isArray(body.formats) ? body.formats : []).map((format) => stringChoice(format, ["svg", "png", "pdf"] as const, "format"))));
  if (!formats.length) throw new ApiInputError("formats must contain at least one output format.");
  const temporaryRaw = body.temporary;
  const temporary = temporaryRaw === undefined || temporaryRaw === null
    ? null
    : (() => {
        const candidate = objectValue(temporaryRaw, "temporary");
        const xValue = Number(candidate.x);
        const yValue = Number(candidate.y);
        if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) throw new ApiInputError("temporary x and y must be finite numbers.");
        return { x: xValue, y: yValue, label: typeof candidate.label === "string" ? candidate.label.slice(0, 80) : "User input" };
      })();
  const highlights = Array.isArray(body.highlight_record_ids)
    ? Array.from(new Set(body.highlight_record_ids.map(String).filter(Boolean))).slice(0, MAX_HIGHLIGHTS)
    : [];
  const comparisonGrades = body.comparison_grades === undefined
    ? (["A", "B", "C", "D"] as ComparabilityGrade[])
    : Array.from(new Set(
        (Array.isArray(body.comparison_grades) ? body.comparison_grades : [])
          .map((grade) => stringChoice(grade, ["A", "B", "C", "D"] as const, "comparison_grades"))
      ));
  if (!comparisonGrades.length) throw new ApiInputError("comparison_grades must contain at least one of A, B, C, or D.");
  const requestedRelease = body.release === undefined
    ? undefined
    : (() => {
        if (typeof body.release !== "string" || !body.release.trim() || body.release.trim().length > 160) {
          throw new ApiInputError("release must be a non-empty string of at most 160 characters.");
        }
        return body.release.trim();
      })();
  filterSearchParams(body.filters);
  if (temporary && (kind === "scatter" || kind === "ashby") && xScale === "log" && temporary.x <= 0) {
    throw new ApiInputError("temporary x must be positive on a logarithmic x-axis.");
  }
  if (temporary && yScale === "log" && temporary.y <= 0) {
    throw new ApiInputError("temporary y must be positive on a logarithmic y-axis.");
  }
  return {
    kind,
    x,
    y,
    release: requestedRelease,
    x_scale: xScale,
    y_scale: yScale,
    top,
    top_by: topBy,
    temporary,
    selected_record_id: typeof body.selected_record_id === "string" ? body.selected_record_id.slice(0, 120) : null,
    highlight_record_ids: highlights,
    comparison_grades: comparisonGrades,
    formats,
    filters: body.filters ? objectValue(body.filters, "filters") : {}
  };
}

function countBy(records: PlotRecord[], key: (record: PlotRecord) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  records.forEach((record) => {
    const value = key(record);
    counts[value] = (counts[value] ?? 0) + 1;
  });
  return counts;
}

function figureCounts(records: PlotRecord[]): FigureCounts {
  return {
    material_families: countBy(records, (record) => record.material_family),
    form_factors: countBy(records, (record) => record.form_factor),
    release_tiers: countBy(records, (record) => record.public_release_tier),
    provenance: countBy(records, (record) => record.dataset_provenance)
  };
}

function citationForRecord(citations: CitationBundle, recordId: string): string {
  return citations.entries
    .filter((entry) => entry.record_ids.includes(recordId) && entry.roles.some((role) => role === "original" || role === "compilation"))
    .map((entry) => entry.text)
    .filter((text, index, all) => all.indexOf(text) === index)
    .join(" | ");
}

function topPoint(
  record: PlotRecord,
  rank: number,
  x: PropertyKey,
  y: PropertyKey,
  citations: CitationBundle,
  comparability: FigureComparability
): FigureTopPoint {
  const xMeta = PROPERTY_BY_KEY.get(x);
  const yMeta = PROPERTY_BY_KEY.get(y);
  const xValue = record.values[x];
  const yValue = record.values[y];
  if (typeof yValue !== "number" || !Number.isFinite(yValue)) throw new Error(`Top record ${record.record_id} is missing ${y}.`);
  return {
    rank,
    label: record.public_sample_label || record.record_label,
    material_family: FAMILY_LABELS[record.material_family] ?? record.material_family,
    form_factor: FORM_LABELS[record.form_factor] ?? record.form_factor,
    x_value: typeof xValue === "number" && Number.isFinite(xValue) ? xValue : null,
    x_unit: xMeta?.displayUnit ?? "",
    y_value: yValue,
    y_unit: yMeta?.displayUnit ?? "",
    doi: record.doi_verified ?? record.doi_raw,
    publication_title: record.publication_title_verified,
    publication_year: record.publication_year_verified,
    citation: citationForRecord(citations, record.record_id),
    comparability_grade: comparability.points[record.record_id]?.grade ?? "D"
  };
}

function renderFigureSvg(
  records: PlotRecord[],
  request: ReturnType<typeof parseRequest>,
  selectedId: string | null,
  release: Awaited<ReturnType<typeof getReleaseDescriptor>>
): { display: string; exportSvg: string } {
  const common = {
    records,
    kind: request.kind,
    x: request.x,
    y: request.y,
    xScale: request.x_scale ?? "linear",
    yScale: request.y_scale ?? "linear",
    selectedId,
    highlightedIds: new Set(request.highlight_record_ids),
    temporary: request.temporary ?? null,
    documentMetadata: {
      releaseId: release.release_id,
      sourceHash: release.source_hash
    }
  };
  return {
    display: renderSvgFigure({ ...common, referenceLines: RANKED_REFERENCE_LINES[request.y] ?? [], interactive: true }),
    exportSvg: renderSvgFigure({ ...common, referenceLines: RANKED_REFERENCE_LINES[request.y] ?? [], interactive: false })
  };
}

function renderVectorPdf(svg: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfSvg = svg.replace(
      "</style>",
      `.minor-grid-line { stroke: #f0f2ef; stroke-opacity: 1; stroke-width: 0.28; }
.point-label, .ashby-region-label, .temporary-point-label { paint-order: normal; stroke: none; }
</style>`
    );
    const chunks: Buffer[] = [];
    const document = new PDFDocument({
      size: [FIGURE_WIDTH, FIGURE_HEIGHT],
      margin: 0,
      compress: true,
      info: {
        Title: "Carbon Property Tables figure",
        Author: "Gaurav Sharma and Adam M. Boies",
        Subject: "Publication-ready carbon material property figure"
      }
    });
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    try {
      SVGtoPDF(document, pdfSvg, 0, 0, {
        width: FIGURE_WIDTH,
        height: FIGURE_HEIGHT,
        preserveAspectRatio: "xMidYMid meet",
        assumePt: true,
        precision: 4,
        warningCallback: (warning) => {
          if (!warning.includes("Could not find font")) console.warn(`SVG-to-PDF warning: ${warning}`);
        }
      });
      document.end();
    } catch (error) {
      document.end();
      reject(error);
    }
  });
}

async function renderBinaryImages(svg: string, formats: FigureFormat[]) {
  const images: FigureResponse["images"] = {};
  if (formats.includes("svg")) images.svg = svg;
  if (formats.includes("png")) {
    const png = new Resvg(svg, {
      background: "#ffffff",
      fitTo: { mode: "width", value: FIGURE_WIDTH },
      font: {
        loadSystemFonts: false,
        fontFiles: RASTER_FONT_FILES,
        defaultFontFamily: "Arimo",
        sansSerifFamily: "Arimo"
      }
    }).render().asPng();
    images.png_base64 = Buffer.from(png).toString("base64");
  }
  if (formats.includes("pdf")) {
    images.pdf_base64 = (await renderVectorPdf(svg)).toString("base64");
  }
  return images;
}

export async function buildFigureResponse(rawRequest: unknown): Promise<FigureResponse> {
  const request = parseRequest(rawRequest);
  const filters = filterSearchParams(request.filters);
  const requiredProperties = request.kind === "scatter" || request.kind === "ashby" ? [request.x, request.y] : [request.y];
  const query = parseRecordQuery(filters, { defaultLimit: 2000, maxLimit: 2000, requiredProperties });
  const [release, page] = await Promise.all([getReleaseDescriptor(), queryCanonicalRecords(query)]);
  if (request.release && request.release !== release.release_id) {
    throw new ApiInputError(
      `Requested release ${request.release} is not available from this deployment; active release is ${release.release_id}.`
    );
  }
  if (page.hasMore) {
    throw new ApiInputError("The requested figure exceeds 2,000 eligible records. Apply material, form-factor, year, or measurement filters.");
  }
  let records = representativeRecords(page.records.map((item) => item.record), request.x, request.y, request.kind);
  if (request.kind === "trend") {
    records = records.filter((record) => typeof record.publication_year_verified === "number" && Number.isFinite(record.publication_year_verified));
  }
  if (!records.length) throw new ApiInputError("No records match the requested figure axes and filters.");
  if ((request.x_scale === "log" || request.kind === "ashby") && request.kind !== "ranked" && request.kind !== "trend") {
    records = records.filter((record) => (record.values[request.x] ?? 0) > 0);
  }
  if (request.y_scale === "log" || request.kind === "ashby") {
    records = records.filter((record) => (record.values[request.y] ?? 0) > 0);
  }
  if (!records.length) throw new ApiInputError("No positive records remain for the requested logarithmic axes.");
  const requestedGrades = new Set(request.comparison_grades ?? ["A", "B", "C", "D"]);
  let comparability = figureComparability(records, request.x, request.y, request.kind);
  records = records.filter((record) => requestedGrades.has(comparability.points[record.record_id]?.grade ?? "D"));
  if (!records.length) throw new ApiInputError("No records remain after applying the comparison-grade filter.");
  comparability = figureComparability(records, request.x, request.y, request.kind);
  const requestedSelection = request.selected_record_id
    ? records.find((record) => record.record_id === request.selected_record_id) ?? null
    : null;
  const selected = requestedSelection ?? defaultSelectedRecord(records, request.x, request.y);
  const citations = citationBundleForRecords(records);
  const selectedTop = topRecords(records, request.x, request.y, Number(request.top ?? 0), (request.top_by ?? "auto") as FigureTopAxis);
  const rendered = renderFigureSvg(records, request, selected?.record_id ?? null, release);
  const images = await renderBinaryImages(rendered.exportSvg, request.formats ?? ["svg"]);
  const xMeta = PROPERTY_BY_KEY.get(request.x);
  const yMeta = PROPERTY_BY_KEY.get(request.y);
  if (!xMeta || !yMeta) throw new Error("Figure property metadata disappeared during rendering.");
  return {
    ...apiMeta(release),
    api_version: "v1",
    kind: request.kind,
    axes: {
      x: { key: xMeta.key, label: xMeta.label, canonicalUnit: xMeta.canonicalUnit, displayUnit: xMeta.displayUnit },
      y: { key: yMeta.key, label: yMeta.label, canonicalUnit: yMeta.canonicalUnit, displayUnit: yMeta.displayUnit }
    },
    point_count: records.length,
    record_ids: records.map((record) => record.record_id),
    display_svg: rendered.display,
    images,
    top_points: selectedTop.map((record, index) => topPoint(record, index + 1, request.x, request.y, citations, comparability)),
    citations,
    temporary_point: temporaryRank(records, request.temporary, request.x, request.y),
    selected_record: selected,
    counts: figureCounts(records),
    comparability
  };
}
