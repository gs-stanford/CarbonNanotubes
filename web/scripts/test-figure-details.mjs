import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3002";
async function post(path, body, status = 200) {
  const start = performance.now();
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  assert.equal(response.status, status, JSON.stringify(payload));
  return { payload, headers: response.headers, ms: performance.now() - start };
}
const request = { kind: "scatter", x: "specific_strength", y: "specific_electrical_conductivity", x_scale: "log", y_scale: "log", top: 0, formats: ["svg"], interactive_details: true };
const figure = await post("/api/v1/figures", request);
assert.equal(figure.headers.get("cache-control"), "no-store");
const token = figure.payload.selection_context.token;
const selected = figure.payload.selected_record;
const detail = await post("/api/v1/figures/selection", { context_token: token, record_id: selected.record_id });
assert.deepEqual(detail.payload.record, selected);
assert.deepEqual(detail.payload.release, figure.payload.release);
assert.equal(detail.headers.get("cache-control"), "no-store");
assert.deepEqual(Object.keys(detail.payload).sort(), ["api_version", "record", "release"]);
const another = figure.payload.record_ids.find(id => id !== selected.record_id);
const other = await post("/api/v1/figures/selection", { context_token: token, record_id: another });
const legacy = await post("/api/v1/figures", { ...request, interactive_details: false, selected_record_id: another });
assert.deepEqual(other.payload.record, legacy.payload.selected_record);
assert.equal(legacy.payload.selection_context, undefined);
const missing = await post("/api/v1/figures/selection", { context_token: token, record_id: "rec_not_in_figure" }, 404);
assert.equal(missing.payload.error.code, "not_plotted");
await post("/api/v1/figures/selection", { context_token: "a".repeat(43), record_id: another }, 410);
for (const body of [{ record_id: another }, { context_token: token, record_id: [another] }, null, { context_token: token, record_id: "x".repeat(121) }]) {
  await post("/api/v1/figures/selection", body, 400);
}
await post("/api/v1/figures", { ...request, interactive_details: "yes" }, 400);
console.log(JSON.stringify({ result: "Figure detail tests passed: exact values/release, single-record scope, denied forgery/non-members, no export snapshot, invalid input", figure_ms: figure.ms, detail_ms: detail.ms, figure_bytes: JSON.stringify(figure.payload).length, detail_bytes: JSON.stringify(detail.payload).length }, null, 2));
