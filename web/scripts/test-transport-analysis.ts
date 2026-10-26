import assert from "node:assert/strict";
import { transportAnalysis, ratio } from "../lib/transport-analysis";

const call = (request: unknown) => transportAnalysis(request) as any;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const catalog = call({ action: "catalog" });
assert.equal(catalog.contrasts.length, 54);
assert.equal(catalog.groups.reduce((n: number, g: any) => n + g.retained_contrasts, 0), 38);
const result = call({ action: "compare", ids: ["piontkowski2025_preheat", "piraux1985_cucl2"] });
near(result.result[0].response.thermal[0], 398 / 364);
near(result.result[0].response.selectivity[0], (398 * 6.7) / (364 * 3));
near(result.result[0].response.selectivity[1], (398 * 6.7) / (364 * 2));
near(result.result[1].response.selectivity[0], (184 * .373) / (500 * 3.91));
assert.equal(result.result[0].direction.electrical, "decrease");
assert.equal(result.result[1].direction.thermal, "decrease");
assert.match(result.result[1].qualification, /not a before measurement/);
assert.equal(call({ action: "compare", ids: ["piontkowski2025_preheat", "piraux1985_cucl2"] }).calculation_receipt_sha256, result.calculation_receipt_sha256);
assert.throws(() => call({ action: "compare", ids: ["vijaykumar2026_heating"] }), /contextual/);
assert.ok(call({ action: "compare", ids: ["vijaykumar2026_heating"], include_contextual: true }).result[0].qualification.includes("not a matched"));
assert.throws(() => call({ action: "compare", ids: ["no-such-comparison"] }), /Unknown/);
assert.throws(() => call({ action: "catalog", group: "fake" }), /Unknown/);
assert.throws(() => call({ action: "catalog", version: "outdated" }), /unavailable/);
assert.throws(() => call({ action: "catalog", material: "not supported" }), /Unrecognized/);
assert.throws(() => call({ action: "compare", ids: Array(4).fill("piraux1985_cucl2") }));
assert.throws(() => call({ action: "compare", ids: Array(2).fill("piraux1985_cucl2") }), /Repeated/);
assert.throws(() => ratio(0, 1), /Invalid/);
assert.throws(() => ratio([3, 2], 1), /Invalid/);
assert.throws(() => ratio(Infinity, 1), /Invalid/);
const source = call({ action: "source", doi: "https://doi.org/10.1021/acs.jpcc.5c05657" });
assert.equal(source.found, true);
assert.ok(source.source.locators.some((x: string) => x.includes("Fig.2b")));
assert.ok(!JSON.stringify(source).includes("/Users/"));
assert.ok(!JSON.stringify(result).includes("sigma_MS_m"));
assert.equal(call({ action: "source", doi: "10.1/missing" }).found, false);
assert.equal(call({ action: "compare", ids: ["gic2_p100_4"], include_contextual: true }).result[0].source_url, null);
assert.equal(call({ action: "compare", ids: ["nasa_p100_bromination_product"], include_contextual: true }).result[0].source_url, "https://ntrs.nasa.gov/citations/19870003126");
for (const c of catalog.contrasts) {
  const r = call({ action: "compare", ids: [c.id], include_contextual: true });
  assert.ok(r.result[0].response.selectivity.every((x: number) => Number.isFinite(x) && x > 0));
}
console.log(JSON.stringify({ status: "pass", evaluated_comparisons: 54, retained: 38,
  version: catalog.analysis_version, numerical_reference_cases: 3,
  model_calls: 0, scope: "Executed tool arithmetic and input/disclosure boundaries, not an LLM answer-quality evaluation" }));
