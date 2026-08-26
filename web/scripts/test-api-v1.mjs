import assert from "node:assert/strict";

const baseUrl = (process.env.CPT_TEST_URL ?? "http://localhost:3001").replace(/\/$/, "");

function assertPublicHeaders(response, path) {
  assert.equal(response.headers.get("access-control-allow-origin"), "*", `${path} is missing CORS headers`);
  assert.equal(
    response.headers.get("x-cpt-citation-policy"),
    "original-sources-plus-atlas",
    `${path} is missing the citation policy header`
  );
}

function allObjectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => allObjectKeys(item, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      keys.add(key);
      allObjectKeys(item, keys);
    });
  }
  return keys;
}

async function getJson(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, expectedStatus, `${path} returned HTTP ${response.status}`);
  assertPublicHeaders(response, path);
  return response.json();
}

async function postJson(path, body, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, expectedStatus, `${path} returned HTTP ${response.status}`);
  assertPublicHeaders(response, path);
  return response.json();
}

const index = await getJson("/api/v1");
assert.equal(index.api_version, "v1");
assert.ok(index.release.record_count > 0);
assert.ok(index.endpoints.figures.endsWith("/figures"));
assert.equal(index.endpoints.records, undefined);
assert.equal(index.endpoints.plot, undefined);

const release = await getJson("/api/v1/release");
assert.equal(release.release.record_count, index.release.record_count);
assert.ok(["bundled_csv", "postgresql"].includes(release.release.backend));

const knownDoi = await getJson(`/api/v1/doi-status?doi=${encodeURIComponent("https://doi.org/10.1126/science.adj1082")}`);
assert.equal(knownDoi.in_database, true);
assert.equal(knownDoi.query_doi, "10.1126/science.adj1082");
assert.ok(knownDoi.publication.title);
assert.equal(knownDoi.record_ids, undefined);
assert.equal(knownDoi.measurements, undefined);
assert.equal(knownDoi.properties, undefined);

const compilationDoi = await getJson(`/api/v1/doi-status?doi=${encodeURIComponent("10.1002/adma.202008432")}`);
assert.equal(compilationDoi.in_database, true);
assert.equal(compilationDoi.publication.role, "compilation");
assert.ok(compilationDoi.publication.title);

const absentDoi = await getJson(`/api/v1/doi-status?doi=${encodeURIComponent("10.5555/cpt.definitely-absent")}`);
assert.equal(absentDoi.in_database, false);
assert.equal(absentDoi.publication, null);
const invalidDoi = await getJson(`/api/v1/doi-status?doi=${encodeURIComponent("not-a-doi")}`, 400);
assert.equal(invalidDoi.error.code, "invalid_request");

const exactSearch = await getJson(`/api/v1/search?q=${encodeURIComponent("https://doi.org/10.1126/science.adj1082")}`);
assert.equal(exactSearch.results.length, 1);
assert.equal(exactSearch.results[0].doi, "10.1126/science.adj1082");
assert.deepEqual(exactSearch.results[0].match_fields, ["doi"]);

const authorSearch = await getJson(`/api/v1/search?q=${encodeURIComponent("Xinshi Zhang dynamic strength")}&limit=10`);
assert.ok(authorSearch.results.length > 0);
assert.equal(authorSearch.results[0].doi, "10.1126/science.adj1082");
assert.ok(authorSearch.results[0].match_fields.includes("author"));
assert.equal(new Set(authorSearch.results.map((result) => result.doi ?? `${result.title}:${result.year}`)).size, authorSearch.results.length);

const keywordSearch = await getJson(`/api/v1/search?q=${encodeURIComponent("iodine doped")}`);
assert.equal(keywordSearch.results[0].doi, "10.1038/srep00083");

const compilationSearch = await getJson(`/api/v1/search?q=${encodeURIComponent("10.1002/adma.202008432")}`);
assert.equal(compilationSearch.results.length, 1);
assert.equal(compilationSearch.results[0].role, "compilation");
assert.ok(compilationSearch.results[0].title.includes("Meta"));
const compilationAuthorSearch = await getJson(`/api/v1/search?q=${encodeURIComponent("James Elliott meta-analysis")}`);
assert.equal(compilationAuthorSearch.results[0].doi, "10.1002/adma.202008432");
assert.ok(compilationAuthorSearch.results[0].match_fields.includes("author"));

const forbiddenSearchKeys = new Set([
  "record_id", "record_ids", "sample", "samples", "measurements", "values", "coordinates",
  "matched_rows", "material_families", "form_factors", "property", "properties"
]);
for (const key of allObjectKeys(authorSearch)) {
  assert.ok(!forbiddenSearchKeys.has(key), `Public search leaked forbidden key '${key}'.`);
}
const missingSearch = await getJson("/api/v1/search", 400);
assert.equal(missingSearch.error.code, "invalid_request");
const invalidSearchLimit = await getJson(`/api/v1/search?q=CNT&limit=26`, 400);
assert.equal(invalidSearchLimit.error.code, "invalid_request");

const properties = await getJson("/api/v1/properties");
const tensileStrength = properties.properties.find((property) => property.key === "tensile_strength");
assert.equal(tensileStrength.canonical_unit, "Pa");

const figureRequest = {
  kind: "scatter",
  release: release.release.release_id,
  x: "specific_strength",
  y: "specific_electrical_conductivity",
  x_scale: "log",
  y_scale: "log",
  top: 3,
  top_by: "y",
  temporary: { x: 1.8, y: 12.0, label: "Candidate" },
  formats: ["svg", "png", "pdf"],
  comparison_grades: ["A", "B", "C", "D"],
  filters: {
    material_family: ["CNT_or_CNT_hybrid", "CNT_metal_composite"],
    peer_reviewed: true
  }
};

const figure = await postJson("/api/v1/figures", figureRequest);
assert.equal(figure.api_version, "v1");
assert.equal(figure.kind, "scatter");
assert.ok(figure.point_count > 0);
assert.ok(figure.top_points.length > 0 && figure.top_points.length <= 3);
assert.ok(figure.top_points.every((row, index) => row.rank === index + 1 && row.citation));
assert.ok(figure.top_points.every((row) => ["A", "B", "C", "D"].includes(row.comparability_grade)));
assert.equal(figure.comparability.model_version, "cpt-property-pair-v1");
assert.equal(figure.comparability.inter_record_method_compatibility, "not_assessed");
assert.ok(figure.citations.entries.some((entry) => entry.roles.includes("atlas")));
assert.equal(new Set(figure.citations.entries.map((entry) => entry.citation_id)).size, figure.citations.entries.length);
assert.equal(figure.temporary_point.label, "Candidate");
assert.ok(Number.isInteger(figure.temporary_point.y_rank));
assert.ok(figure.display_svg.includes("data-record-id="));
assert.ok(figure.images.svg.includes("<svg"));
assert.ok(!figure.images.svg.includes("data-record-id="));
assert.ok(!figure.images.svg.includes("plot-watermark"));
assert.ok(figure.images.svg.includes('baseline-shift="super"'));
assert.ok(
  figure.images.svg.includes('class="plot-point point-material-cnt point-shape-circle quality-'),
  "CNT markers must retain their material color class in exported SVGs."
);
const png = Buffer.from(figure.images.png_base64, "base64");
assert.ok(png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
assert.equal(png.readUInt32BE(16), 920);
assert.equal(png.readUInt32BE(20), 632);
assert.ok(png.length > 65_000, "PNG export is unexpectedly sparse; publication text glyphs may be missing.");
const pdf = Buffer.from(figure.images.pdf_base64, "base64");
assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
assert.ok(!pdf.toString("latin1").includes("/Subtype /Image"), "PDF export must remain vector, not a full-page raster image");
assert.equal(figure.points, undefined);
assert.equal(figure.records, undefined);

for (const path of [
  "/api/v1/records?limit=1",
  "/api/v1/records/rec_f8e2b6a26ecb",
  "/api/v1/plot?x=specific_strength&y=specific_electrical_conductivity",
  "/api/records",
  "/api/measurements",
  "/api/plot-data?x=specific_strength&y=specific_electrical_conductivity"
]) {
  const hidden = await getJson(path, 404);
  assert.equal(hidden.error.code, "not_found");
}

const invalidTop = await postJson("/api/v1/figures", { ...figureRequest, formats: ["svg"], top: 11 }, 400);
assert.equal(invalidTop.error.code, "invalid_request");

const unavailableRelease = await postJson(
  "/api/v1/figures",
  { ...figureRequest, formats: ["svg"], release: "public-v0-unavailable" },
  400
);
assert.equal(unavailableRelease.error.code, "invalid_request");

const invalidComparisonGrade = await postJson(
  "/api/v1/figures",
  { ...figureRequest, formats: ["svg"], comparison_grades: ["Z"] },
  400
);
assert.equal(invalidComparisonGrade.error.code, "invalid_request");

const emptyComparisonGrades = await postJson(
  "/api/v1/figures",
  { ...figureRequest, formats: ["svg"], comparison_grades: [] },
  400
);
assert.equal(emptyComparisonGrades.error.code, "invalid_request");

const contextOnlyFigure = await postJson(
  "/api/v1/figures",
  { ...figureRequest, formats: ["svg"], top: 0, comparison_grades: ["D"], filters: {} }
);
assert.ok(contextOnlyFigure.point_count > 0);
assert.deepEqual(contextOnlyFigure.comparability.grade_counts, { A: 0, B: 0, C: 0, D: contextOnlyFigure.point_count });

const invalidFilter = await postJson(
  "/api/v1/figures",
  { ...figureRequest, formats: ["svg"], top: 0, filters: { raw_database_dump: true } },
  400
);
assert.equal(invalidFilter.error.code, "invalid_request");

const searchResponse = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent("10.1126/science.adj1082")}&limit=20`);
assert.equal(searchResponse.status, 200);
const search = await searchResponse.json();
assert.equal(search.results.filter((result) => result.doi === "10.1126/science.adj1082").length, 1);
assert.ok(search.results.find((result) => result.doi === "10.1126/science.adj1082").matched_rows > 1);

const pageResponse = await fetch(`${baseUrl}/`);
assert.equal(pageResponse.status, 200);
const pageHtml = await pageResponse.text();
assert.ok(!pageHtml.includes("canonicalValues"));
assert.ok(!pageHtml.includes("rec_f8e2b6a26ecb"));

const openapi = await getJson("/api/v1/openapi.json");
assert.equal(openapi.openapi, "3.1.0");
assert.ok(openapi.paths["/api/v1/figures"]);
assert.ok(openapi.paths["/api/v1/doi-status"]);
assert.ok(openapi.paths["/api/v1/search"]);
assert.equal(openapi.paths["/api/v1/records"], undefined);
assert.equal(openapi.paths["/api/v1/plot"], undefined);

if (release.release.backend === "bundled_csv") {
  const unavailableSubmissionResponse = await fetch(`${baseUrl}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publication: { doi: "10.1038/srep00083" } })
  });
  assert.equal(unavailableSubmissionResponse.status, 503);
  const unavailableSubmission = await unavailableSubmissionResponse.json();
  assert.equal(unavailableSubmission.error.code, "submission_storage_unavailable");
}

console.log(
  `CPT bounded API passed: ${properties.properties.length} properties, ${figure.point_count} rendered representative points, ` +
    `${figure.top_points.length} capped exact rows, raw routes hidden.`
);
