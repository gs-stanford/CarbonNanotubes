import type { CitationBundle } from "@/lib/citations";
import type { PlotRecord, PropertyKey, PropertyMeta, ScaleMode } from "@/lib/data";
import type { ReleaseDescriptor } from "@/lib/query-store";
import type { ComparabilityGrade, FigureComparability } from "@/lib/comparability";

export type FigureKind = "scatter" | "ranked" | "trend" | "ashby";
export type FigureTopAxis = "auto" | "x" | "y";
export type FigureFormat = "svg" | "png" | "pdf";

export type FigureTemporaryPoint = {
  x: number;
  y: number;
  label?: string;
};

export type FigureRequest = {
  kind: FigureKind;
  x: PropertyKey;
  y: PropertyKey;
  release?: string;
  x_scale?: ScaleMode;
  y_scale?: ScaleMode;
  top?: number;
  top_by?: FigureTopAxis;
  temporary?: FigureTemporaryPoint | null;
  selected_record_id?: string | null;
  highlight_record_ids?: string[];
  formats?: FigureFormat[];
  filters?: Record<string, unknown>;
  comparison_grades?: ComparabilityGrade[];
};

export type FigureTopPoint = {
  rank: number;
  label: string;
  material_family: string;
  form_factor: string;
  x_value: number | null;
  x_unit: string;
  y_value: number;
  y_unit: string;
  doi: string | null;
  publication_title: string | null;
  publication_year: number | null;
  citation: string;
  comparability_grade: ComparabilityGrade;
};

export type FigureTemporaryRank = {
  label: string;
  x: number;
  y: number;
  total_with_temporary: number;
  x_rank: number | null;
  y_rank: number | null;
  x_percentile: number | null;
  y_percentile: number | null;
  dominated_by: number | null;
  on_pareto_frontier: boolean | null;
};

export type FigureCounts = {
  material_families: Record<string, number>;
  form_factors: Record<string, number>;
  release_tiers: Record<string, number>;
  provenance: Record<string, number>;
};

export type FigureResponse = {
  api_version: "v1";
  generated_at: string;
  release: ReleaseDescriptor;
  kind: FigureKind;
  axes: {
    x: Pick<PropertyMeta, "key" | "label" | "canonicalUnit" | "displayUnit">;
    y: Pick<PropertyMeta, "key" | "label" | "canonicalUnit" | "displayUnit">;
  };
  point_count: number;
  record_ids: string[];
  display_svg: string;
  images: {
    svg?: string;
    png_base64?: string;
    pdf_base64?: string;
  };
  top_points: FigureTopPoint[];
  citations: CitationBundle;
  temporary_point: FigureTemporaryRank | null;
  selected_record: PlotRecord | null;
  counts: FigureCounts;
  comparability: FigureComparability;
};

export type ExplorerBootstrap = {
  properties: PropertyMeta[];
  families: string[];
  forms: string[];
  summary: {
    recordCount: number;
    measurementCount: number;
    primaryRecords: number;
    benchmarkRecords: number;
    peerReviewedResearchRecords: number;
    peerReviewedComparatorRecords: number;
    commercialComparatorRecords: number;
    authorCuratedCompilationRecords: number;
    primarySourceVerifiedCompilationRecords: number;
    primarySourceCheckPendingRecords: number;
    strictReadyRecords: number;
    minYear: number | null;
    maxYear: number | null;
  };
};
