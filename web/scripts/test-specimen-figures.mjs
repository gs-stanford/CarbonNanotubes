import assert from "node:assert/strict";
import { DEFAULT_FIGURE_FORMS } from "../lib/specimen-forms.mjs";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3005";
const request = { kind: "scatter", x: "electrical_conductivity", y: "thermal_conductivity", x_scale: "log", y_scale: "log", formats: ["svg"] };
async function plot(patch, status = 200) {
  const response = await fetch(`${base}/api/v1/figures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, ...patch }) });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
const initial = await plot({});
assert.deepEqual(initial.request.filters.form_factor, [...DEFAULT_FIGURE_FORMS]);
assert.ok(!initial.record_ids.includes("rec_170355132b02"));
assert.ok(!initial.record_ids.includes("rec_fc1191f385c6"));
await plot({ filters: { form_factor: ["fiber_yarn", "sheet_mat_film"], doi: "10.1063/1.3147183" } }, 400);
const device = await plot({ filters: { form_factor: ["micro_nanoscale_device"], doi: "10.1063/1.3147183" }, selected_record_id: "rec_170355132b02", formats: ["svg", "png", "pdf"] });
assert.deepEqual(device.record_ids, ["rec_170355132b02"]);
assert.equal(device.selected_record.form_factor, "micro_nanoscale_device");
assert.equal(device.selected_record.values.thermal_conductivity, 1100);
assert.equal(device.selected_record.measurementMetadata.thermal_conductivity.reported_or_derived, "source_estimate");
assert.match(device.selected_record.measurementMetadata.thermal_conductivity.source_qualification, /model estimate/);
await plot({ filters: { form_factor: "micro_nanoscale_device", doi: "10.1063/1.3147183", exclude_source_estimates: true } }, 400);
assert.match(device.images.svg, /Micro \/ nanoscale device/);
assert.equal(Buffer.from(device.images.png_base64, "base64").subarray(1, 4).toString(), "PNG");
assert.equal(Buffer.from(device.images.pdf_base64, "base64").subarray(0, 4).toString(), "%PDF");
for (const kind of ["scatter", "trend", "ranked", "ashby"]) {
  const response = await plot({ kind, x: "specific_strength", y: "specific_electrical_conductivity" });
  assert.ok(!response.record_ids.includes("rec_7a9c079963dd"), `${kind}: graphite reference excluded by default`);
}
const crystal = await plot({ x: "specific_strength", y: "specific_electrical_conductivity", filters: { form_factor: ["bulk_single_crystal"] } });
assert.ok(crystal.record_ids.includes("rec_7a9c079963dd"));
assert.equal(crystal.selected_record.form_factor, "bulk_single_crystal");
for (const form_factor of [[], "", null, "not_a_form"]) await plot({ filters: { form_factor } }, 400);
assert.deepEqual((await plot(initial.request)).record_ids, initial.record_ids, "Replay preserves default cohort");
console.log("Figure API checks passed: all four defaults, explicit reference opt-in, empty cohort, empty/invalid filters, estimate exclusion, SVG/PNG/PDF and replay.");
