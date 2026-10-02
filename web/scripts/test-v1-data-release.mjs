import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.CPT_TEST_URL ?? "http://localhost:3012").replace(/\/$/, "");
const outputDir = path.resolve(process.env.CPT_RELEASE_TEST_OUTPUT ?? "../reports/v1_data_release_verification");
const checks = [];

async function figure(body) {
  const response = await fetch(`${baseUrl}/api/v1/figures`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload.error));
  return payload;
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-8), `${label}: ${actual} != ${expected}`);
}

const releaseResponse = await fetch(`${baseUrl}/api/v1/release`);
assert.equal(releaseResponse.status, 200);
const { release } = await releaseResponse.json();
assert.equal(release.record_count, 1447);
assert.equal(release.measurement_count, 5569);
assert.equal(release.publication_count, 320);

const metals = await figure({
  kind: "scatter", x: "density", y: "specific_electrical_conductivity", top: 10, top_by: "y",
  formats: ["svg", "png", "pdf"], filters: { material_family: ["metal_comparator"] }
});
for (const [label, name, resistivity, density] of [["Na", "Sodium", 47.7e-9, 971.2], ["Ca", "Calcium", 33.6e-9, 1550], ["Li", "Lithium", 92.8e-9, 534], ["K", "Potassium", 72e-9, 871], ["Mg", "Magnesium", 43.9e-9, 1740]]) {
  const row = metals.top_points.find((item) => item.label.startsWith(name + ","));
  assert.ok(row, `${label} must appear in the bounded metal comparison.`);
  close(row.x_value, density, `${label} density`);
  close(row.y_value, 1 / resistivity / density / 1000, `${label} specific conductivity`);
  assert.match(row.citation, /10\.1063\/1\.55559[89]/);
  assert.ok(metals.images.svg.includes(`>${label}</text>`), `${label} callout is missing.`);
  checks.push({ label, density_kg_m3: row.x_value, specific_conductivity_kS_m2_kg: row.y_value, doi: row.doi });
}
assert.ok(Buffer.from(metals.images.png_base64, "base64").subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
assert.equal(Buffer.from(metals.images.pdf_base64, "base64").subarray(0, 4).toString(), "%PDF");
assert.ok(!metals.images.svg.includes("data-record-id="));
assert.ok(metals.images.svg.includes(">1.5e4</text>"), "A 15,000 density tick must not round to the 20,000 label.");
assert.ok(metals.images.svg.includes(">2.5e4</text>"), "A 25,000 density tick must retain its distinct value.");

const paired = await figure({
  kind: "scatter", x: "tensile_strength", y: "specific_electrical_conductivity", top: 0,
  formats: ["svg"], filters: { material_family: ["metal_comparator"] }
});
for (const label of ["Na", "Ca", "Li", "K", "Mg"]) {
  assert.ok(!paired.images.svg.includes(`>${label}</text>`), `${label} has no admitted tensile strength and must not acquire a fabricated one.`);
}

const commercial = await figure({
  kind: "scatter", x: "initial_modulus", y: "tensile_strength", top: 10, top_by: "y",
  formats: ["svg"], filters: {
    material_family: ["carbon_fiber_comparator"], release_tier: ["commercial_contextual_comparator"]
  }
});
for (const [label, modulus, strength] of [["T1200", 315, 8], ["HexTow IM11", 324, 6.6]]) {
  const row = commercial.top_points.find((item) => item.label.includes(label));
  assert.ok(row, `${label} must be available as a commercial reference.`);
  close(row.x_value, modulus, `${label} modulus`);
  close(row.y_value, strength, `${label} strength`);
  assert.ok(/toray|hexcel/i.test(row.citation));
  checks.push({ label, modulus_GPa: row.x_value, strength_GPa: row.y_value });
}

const doiResponse = await fetch(`${baseUrl}/api/v1/doi-status?doi=10.1038%2Fncomms1583`);
assert.equal(doiResponse.status, 200);
const doi = await doiResponse.json();
assert.equal(doi.in_database, true);
assert.equal(doi.measurements, undefined);
assert.equal(doi.record_ids, undefined);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "metals.svg"), metals.images.svg);
await fs.writeFile(path.join(outputDir, "metals.png"), Buffer.from(metals.images.png_base64, "base64"));
await fs.writeFile(path.join(outputDir, "metals.pdf"), Buffer.from(metals.images.pdf_base64, "base64"));
const report = {
  status: "pass", tested_at: new Date().toISOString(), base_url: baseUrl, release,
  checks, exports: ["svg", "png", "pdf"],
  no_fabricated_tensile_strength: true, doi_lookup_preserves_disclosure_limits: true
};
await fs.writeFile(path.join(outputDir, "results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
