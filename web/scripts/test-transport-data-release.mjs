import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const base = (process.env.CPT_TEST_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const output = path.resolve(process.env.CPT_TRANSPORT_TEST_OUTPUT ?? "../outputs/transport_admission_20261025/api");
await fs.mkdir(output, {recursive: true});
const cases = [
  // Source reference values in API display units (not read back from the release CSV).
  ["10.1016/0038-1098(85)90325-4", "electrical_conductivity", "thermal_conductivity", 3.90625, 184],
  ["10.1007/s12274-017-1683-3", "electrical_conductivity", "thermal_conductivity", 0.516, 94.8],
  ["10.1063/5.0244895", "electrical_conductivity", "thermal_conductivity", 8, 380],
  ["10.1063/5.0244895", "specific_electrical_conductivity", "specific_thermal_conductivity", 5.1, 0.24],
  ["10.1016/j.carbon.2026.121428", "electrical_conductivity", "thermal_conductivity", 0.64, 534],
  ["10.1016/j.carbon.2026.121428", "tensile_strength", "thermal_conductivity", 3.26, 534],
  ["10.1021/acsanm.4c00497", "electrical_conductivity", "thermal_conductivity", 0.0747, 63],
  ["10.1016/j.carbon.2025.120155", "electrical_conductivity", "thermal_conductivity", 0.32023, 74.4],
  ["10.1038/s41467-024-44692-7", "electrical_conductivity", "thermal_conductivity", 1.21, 1660],
  ["10.1038/s41467-024-44692-7", "specific_strength", "specific_thermal_conductivity", 2.9e9 / 2020 / 1e6, 1590 / 2020],
];
const checks = [];
for (const [doi, x, y, expectedX, expectedY] of cases) {
  const status = await (await fetch(`${base}/api/v1/doi-status?doi=${encodeURIComponent(doi)}`)).json();
  assert.equal(status.in_database, true, doi);
  assert.equal(status.measurements, undefined);
  const response = await fetch(`${base}/api/v1/figures`, {method: "POST",
    headers: {"Content-Type": "application/json"}, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({kind: "scatter", x, y, top: 1, top_by: "y", formats: ["svg"],
      filters: {doi, form_factor: "fiber_yarn"}})});
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result.error));
  assert.equal(result.top_points.length, 1);
  const point = result.top_points[0];
  for (const [got, expected] of [[point.x_value, expectedX], [point.y_value, expectedY]]) {
    assert.ok(Math.abs(got-expected) <= Math.max(1e-8, Math.abs(expected)*1e-8), `${doi}: ${got} != ${expected}`);
  }
  assert.ok(result.citations.entries.some(c => c.doi === doi));
  assert.doesNotMatch(result.images.svg, /NaN|Infinity/);
  checks.push({doi, x, y, x_value: point.x_value, y_value: point.y_value, plotted: result.point_count});
}
const cohortChecks = [];
for (const [doi, expected] of [
  ["10.1063/5.0244895", 7], ["10.1016/j.carbon.2026.121428", 5],
  ["10.1021/acsanm.4c00497", 4], ["10.1016/j.carbon.2025.120155", 4],
  ["10.1038/s41467-024-44692-7", 2],
]) {
  // Screening uses all eligible states, not only each paper's default representative.
  const response = await fetch(`${base}/api/v1/figures`, {method: "POST",
    headers: {"Content-Type": "application/json"}, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({kind: "scatter", x: "electrical_conductivity", y: "thermal_conductivity",
      minimum_x: 0, top: 1, top_by: "y", formats: ["svg"], filters: {doi, form_factor: "fiber_yarn"}})});
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result.error));
  assert.equal(result.point_count, expected, `${doi}: missing checkpoint`);
  assert.equal(result.requirement.qualifying_count, expected);
  const metadata = result.selected_record.measurementMetadata;
  for (const property of ["electrical_conductivity", "thermal_conductivity"]) {
    assert.ok(metadata[property].source_locator);
    assert.ok(metadata[property].source_qualification);
  }
  cohortChecks.push({doi, eligible_states: result.point_count, qualifications_present: true});
}
for (const kind of ["scatter", "trend", "ranked", "ashby"]) {
  const response = await fetch(`${base}/api/v1/figures`, {method: "POST",
    headers: {"Content-Type": "application/json"}, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({kind, x: "electrical_conductivity", y: "thermal_conductivity",
      x_scale: "log", y_scale: "log", top: 1, formats: ["svg", "png", "pdf"],
      temporary: {x: 1.2, y: 250, label: "Transport admission test"}, filters: {form_factor: "fiber_yarn"}})});
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result.error));
  assert.equal(result.temporary_point.label, "Transport admission test");
  assert.ok(Buffer.from(result.images.png_base64, "base64").subarray(0,8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
  assert.equal(Buffer.from(result.images.pdf_base64, "base64").subarray(0,4).toString(), "%PDF");
  for (const format of ["svg", "png", "pdf"]) await fs.writeFile(path.join(output, `${kind}.${format}`),
    format === "svg" ? result.images.svg : Buffer.from(result.images[`${format}_base64`], "base64"));
}
const health = await (await fetch(`${base}/api/health/data`)).json();
const verifyDeployment = process.env.CPT_VERIFY_DEPLOYMENT === "1";
if (verifyDeployment) {
  assert.equal(health.status, "ok");
  assert.equal(health.backend, "postgresql");
  assert.equal(health.release.releaseId, "public-v0-5a0708c84b9a6ef7");
  assert.equal(health.release.recordCount, 1543);
  assert.equal(health.release.measurementCount, 5937);
  assert.equal(health.release.publicationCount, 332);
  if (process.env.CPT_EXPECT_COMMIT) assert.equal(health.build.commit, process.env.CPT_EXPECT_COMMIT);
}
const result = {status: "pass", base_url: base, checks, cohort_checks: cohortChecks, health,
  figure_types: ["scatter", "trend", "ranked", "ashby"], formats: ["svg", "png", "pdf"],
  temporary_sample: true, deployment_verified: verifyDeployment};
await fs.writeFile(path.join(output, "verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
