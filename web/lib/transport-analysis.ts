import { createHash } from "node:crypto";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { hasDatabaseUrl, withDb } from "./db";
import { ApiInputError } from "./api-v1";

type Bound = number | number[];
type Contrast = { id: string; group: string; doi: string; lab: string; grade: string;
  before: string; after: string; qualification: string; sigma_MS_m: [Bound, Bound];
  kappa_W_mK: [Bound, Bound]; input_sha256: string };
type Resource = { version: string; resource_sha256: string; input_table_sha256: string;
  source_snapshot: string; scope: string; rights: string; contrasts: Contrast[];
  sources: Record<string, unknown> };

async function loadResource(): Promise<Resource> {
  if (hasDatabaseUrl()) {
    return withDb(async client => {
      const result = await client.query("SELECT payload FROM atlas_analysis_resources WHERE name = $1 AND active", ["transport"]);
      if (result.rows.length !== 1) throw new Error("Processing analysis is not configured on this server.");
      return result.rows[0].payload as Resource;
    });
  }
  if (process.env.NODE_ENV === "production") throw new Error("Backend database is required for processing analysis.");
  const file = process.env.CPT_TRANSPORT_RESOURCE ?? path.join(process.cwd(), "data", "analysis", "transport-v1.json");
  return JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, "utf8")) as Resource;
}
export const transportRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("catalog"), group: z.string().max(100).optional(), version: z.string().max(80).optional() }).strict(),
  z.object({ action: z.literal("compare"), ids: z.array(z.string().max(200)).min(1).max(3), include_contextual: z.boolean().default(false), version: z.string().max(80).optional() }).strict(),
  z.object({ action: z.literal("source"), doi: z.string().min(3).max(200), version: z.string().max(80).optional() }).strict(),
]);

function bounds(value: Bound): [number, number] {
  const result: [number, number] = typeof value === "number" ? [value, value] : [value[0], value[1]];
  if (!result.every(v => Number.isFinite(v) && v > 0) || result[1] < result[0]) throw new Error("Invalid frozen scientific input");
  return result;
}

export function ratio(after: Bound, before: Bound) {
  const a = bounds(after), b = bounds(before);
  return [a[0] / b[1], a[1] / b[0]] as [number, number];
}

export function computeContrast(c: Contrast) {
  const electrical = ratio(c.sigma_MS_m[1], c.sigma_MS_m[0]);
  const thermal = ratio(c.kappa_W_mK[1], c.kappa_W_mK[0]);
  return { electrical, thermal, selectivity: ratio(thermal, electrical) };
}

const retained = (c: Contrast) => ["qualified", "primary_bounded"].includes(c.grade);
const directions = (r: [number, number]) => r[0] > 1 ? "increase" : r[1] < 1 ? "decrease" : "overlaps_no_change";

export async function transportAnalysis(raw: unknown) {
  const parsed = transportRequestSchema.safeParse(raw);
  if (!parsed.success) throw new ApiInputError(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  return analyzeTransportResource(raw, await loadResource());
}

export function analyzeTransportResource(raw: unknown, input: Resource) {
  const parsed = transportRequestSchema.safeParse(raw);
  if (!parsed.success) throw new ApiInputError(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  const request = parsed.data;
  if (request.version && request.version !== input.version) throw new ApiInputError("Analysis version unavailable; no silent update is permitted.");
  const meta = { api_version: "v1", analysis_version: input.version, resource_sha256: input.resource_sha256, input_table_sha256: input.input_table_sha256,
    source_snapshot: input.source_snapshot, scope: input.scope, rights: input.rights,
    formula: { electrical: "sigma_after / sigma_before", thermal: "kappa_after / kappa_before", selectivity: "(kappa_after / kappa_before) / (sigma_after / sigma_before)" },
    units: { responses: "dimensionless", source_electrical: "MS/m", source_thermal: "W/m/K" },
    uncertainty: "Reported intervals are propagated by positive interval arithmetic. These are not confidence intervals and do not incorporate unreported covariance, graph-read allowance or experimental error.",
    disclosure: "Only frozen processing responses and source pointers are exposed, not a queryable bulk measurement table." };
  if (request.action === "source") {
    const doi = request.doi.trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").replace(/^doi:\s*/, "");
    const source = (input.sources as Record<string, unknown>)[doi];
    return { ...meta, found: Boolean(source), source: source ?? { doi, url: `https://doi.org/${encodeURI(doi)}`, locators: [], coverage: "No reviewed pointer package for this DOI in this analysis; not proof of absence from CPT." } };
  }
  if (request.action === "catalog") {
    if (request.group && !input.contrasts.some(c => c.group === request.group)) throw new ApiInputError("Unknown processing group; obtain the unfiltered catalog first.");
    const selected = input.contrasts.filter(c => !request.group || c.group === request.group);
    return { ...meta, groups: [...new Set(selected.map(c => c.group))].map(group => {
      const members = selected.filter(c => c.group === group), primary = members.filter(retained);
      const q = primary.map(c => computeContrast(c).selectivity);
      return { group, retained_contrasts: primary.length, contextual_contrasts: members.length - primary.length,
        publications: new Set(primary.map(c => c.doi)).size,
        selectivity_extent: q.length ? [Math.min(...q.map(a => a[0])), Math.max(...q.map(a => a[1]))] : null,
        independence: "Contrasts are dependent; publication count is not laboratory count." };
    }), contrasts: selected.map(({ id, group, doi, grade, before, after, qualification }) => ({ id, group, doi, grade, before, after, qualification })) };
  }
  if (new Set(request.ids).size !== request.ids.length) throw new ApiInputError("Repeated comparison IDs are not allowed.");
  const selected = request.ids.map(id => {
    const c = input.contrasts.find(row => row.id === id);
    if (!c) throw new ApiInputError(`Unknown comparison: ${id}`);
    if (!retained(c) && !request.include_contextual) throw new ApiInputError(`Comparison ${id} is contextual; explicit include_contextual is required.`);
    return c;
  });
  const result = selected.map(c => {
    const response = computeContrast(c);
    return { id: c.id, group: c.group, doi: c.doi, source_url: c.doi.startsWith("10.") ? `https://doi.org/${c.doi}` : c.doi === "nasa-tm-88888" ? "https://ntrs.nasa.gov/citations/19870003126" : null,
      grade: c.grade, before: c.before, after: c.after, qualification: c.qualification, lab: c.lab,
      response, direction: { electrical: directions(response.electrical), thermal: directions(response.thermal) },
      input_sha256: c.input_sha256,
      interpretation_limit: "A relative preference is not an absolute gain: inspect the electrical and thermal responses separately. Treatment labels do not isolate microscopic causes.",
      source_pointer_available: c.doi in input.sources };
  });
  const receipt = createHash("sha256").update(JSON.stringify({ version: input.version, request, result })).digest("hex");
  return { ...meta, request, result, calculation_receipt_sha256: receipt };
}
