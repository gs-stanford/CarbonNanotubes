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

const properties = await getJson("/api/v1/properties");
const tensileStrength = properties.properties.find((property) => property.key === "tensile_strength");
assert.equal(tensileStrength.canonical_unit, "Pa");

const figureRequest = {
  kind: "scatter",
  x: "specific_strength",
  y: "specific_electrical_conductivity",
  x_scale: "log",
  y_scale: "log",
  top: 3,
  top_by: "y",
  temporary: { x: 1.8, y: 12.0, label: "Candidate" },
  formats: ["svg", "png", "pdf"],
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
  figure.images.svg.includes('class="plot-point point-material-cnt point-shape-circle"'),
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
