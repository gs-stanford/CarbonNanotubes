import assert from "node:assert/strict";

const baseUrl = (process.env.CPT_TEST_URL ?? "http://localhost:3001").replace(/\/$/, "");

async function get(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, expectedStatus, `${path} returned HTTP ${response.status}`);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("x-cpt-citation-policy"), "original-sources-plus-atlas");
  return response.json();
}

const index = await get("/api/v1");
assert.equal(index.api_version, "v1");
assert.equal(index.release.record_count, 1366);

const properties = await get("/api/v1/properties");
const tensileStrength = properties.properties.find((property) => property.key === "tensile_strength");
assert.equal(tensileStrength.canonical_unit, "Pa");

const doiRecords = await get("/api/v1/records?doi=10.1126/science.adj1082&limit=5");
assert.equal(doiRecords.records.length, 4);
assert.ok(doiRecords.records.every((record) => record.publication.doi === "10.1126/science.adj1082"));
assert.ok(doiRecords.records.every((record) => record.citations.entries.some((entry) => entry.roles.includes("atlas"))));

const curated = await get(
  "/api/v1/records?provenance=author_curated_published_compilation&peer_reviewed=true&limit=1"
);
assert.equal(curated.records.length, 1);
assert.ok(curated.records[0].citations.entries.some((entry) => entry.roles.includes("original")));
assert.ok(curated.records[0].citations.entries.some((entry) => entry.roles.includes("compilation")));
assert.ok(curated.records[0].citations.entries.some((entry) => entry.roles.includes("atlas")));

const highStrength = await get(
  "/api/v1/records?property=tensile_strength&min_value=8000000000&material_family=CNT_or_CNT_hybrid&doi=10.1126/science.adj1082&limit=20"
);
assert.ok(highStrength.records.some((record) => record.record_id === "rec_f8e2b6a26ecb"));
assert.ok(
  highStrength.records.every((record) =>
    record.measurements.some((measurement) => measurement.property === "tensile_strength" && measurement.value >= 8e9)
  )
);

const multiProperty = await get(
  "/api/v1/records?doi=10.1126/science.adj1082&measurement_filter=density:1300:1500&measurement_filter=tensile_strength:8000000000:&limit=20"
);
assert.deepEqual(multiProperty.records.map((record) => record.record_id), ["rec_f8e2b6a26ecb"]);

const firstPage = await get("/api/v1/records?limit=1");
assert.equal(firstPage.records.length, 1);
assert.equal(firstPage.pagination.has_more, true);
const secondPage = await get(`/api/v1/records?limit=1&after=${encodeURIComponent(firstPage.pagination.next_cursor)}`);
assert.notEqual(secondPage.records[0].record_id, firstPage.records[0].record_id);

const recordId = highStrength.records[0].record_id;
const oneRecord = await get(`/api/v1/records/${recordId}`);
assert.equal(oneRecord.record.record_id, recordId);

const plot = await get(
  "/api/v1/plot?x=specific_strength&y=specific_electrical_conductivity&material_family=CNT_or_CNT_hybrid&limit=100"
);
assert.ok(plot.points.length > 0);
assert.ok(plot.points.every((point) => point.x.property === "specific_strength"));
assert.ok(plot.points.every((point) => point.y.property === "specific_electrical_conductivity"));
assert.equal(new Set(plot.citations.entries.map((entry) => entry.citation_id)).size, plot.citations.entries.length);

const citationResponse = await fetch(`${baseUrl}/api/v1/citations`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ record_ids: doiRecords.records.slice(0, 2).map((record) => record.record_id) })
});
assert.equal(citationResponse.status, 200);
const citations = await citationResponse.json();
assert.equal(citations.citations.entries.filter((entry) => entry.doi === "10.1126/science.adj1082").length, 1);
assert.equal(citations.citations.entries.find((entry) => entry.doi === "10.1126/science.adj1082").record_ids.length, 2);

const invalid = await get("/api/v1/records?min_value=1", 400);
assert.equal(invalid.error.code, "invalid_request");

const openapi = await get("/api/v1/openapi.json");
assert.equal(openapi.openapi, "3.1.0");

console.log(
  `CPT API v1 passed: ${properties.properties.length} properties, ${plot.points.length} paired plot points, ` +
    `${plot.citations.entries.length} deduplicated plot citations.`
);
