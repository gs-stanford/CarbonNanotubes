import assert from "node:assert/strict";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3002";
const common = { kind: "scatter", x: "specific_strength", y: "specific_electrical_conductivity",
  formats: ["svg"], top: 1, filters: { form_factor: "fiber_yarn", peer_reviewed: true } };
async function request(overrides, expected = 200) {
  const response = await fetch(`${base}/api/v1/figures`, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...common, ...overrides }) });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result.error));
  return result;
}

const standard = await request({});
assert.equal(standard.requirement, null);
for (const kind of ["scatter", "trend", "ashby"]) {
  const shown = await request({kind});
  const hidden = await request({kind, show_callouts:false, formats:["svg", "png", "pdf"]});
  for (const svg of [shown.display_svg, shown.images.svg]) assert.match(svg, /class="point-label"/);
  for (const svg of [hidden.display_svg, hidden.images.svg]) {
    assert.doesNotMatch(svg, /class="point-label"|class="label-leader"/);
    assert.match(svg, /class="axis-title"/);
    assert.match(svg, /class="export-legend"/);
  }
  assert.deepEqual(hidden.record_ids, shown.record_ids);
  assert.deepEqual(hidden.top_points, shown.top_points);
  assert.equal(hidden.citations.bibtex, shown.citations.bibtex);
  assert.ok(Buffer.from(hidden.images.pdf_base64, "base64").subarray(0,4).equals(Buffer.from("%PDF")));
  assert.ok(Buffer.from(hidden.images.png_base64, "base64").subarray(1,4).equals(Buffer.from("PNG")));
}
for (const kind of ["scatter", "ashby"]) {
  const shown = await request({kind, minimum_x:2});
  const hidden = await request({kind, minimum_x:2, show_callouts:false});
  for (const svg of [shown.display_svg, shown.images.svg]) assert.doesNotMatch(svg, /class="requirement-envelope"/);
  for (const svg of [hidden.display_svg, hidden.images.svg]) {
    assert.doesNotMatch(svg, /class="requirement-envelope"/);
    assert.match(svg, /class="requirement-cutoff"/);
    assert.match(svg, /class="requirement-winner"/);
  }
  assert.deepEqual(hidden.requirement, shown.requirement);
  assert.deepEqual(hidden.record_ids, shown.record_ids);
  assert.deepEqual(hidden.top_points, shown.top_points);
}
let count;
for (const [minimum, expected, doi] of [[0,20,"10.1038/srep00083"], [1.9,20,"10.1038/srep00083"],
  [2,5.68527918781726,"10.1016/j.carbon.2022.04.040"], [5,2.07142857142857,"10.1126/science.adj1082"]]) {
  const result = await request({ minimum_x: minimum });
  const r = result.requirement;
  assert.ok(result.point_count > standard.point_count, "Requirement mode must retain within-paper trade-offs");
  assert.ok(Math.abs(r.best.y_value-expected) < 1e-8);
  assert.equal(r.best.doi, doi);
  assert.ok(r.best.x_value >= minimum);
  assert.equal(result.top_points[0].doi, doi);
  assert.ok(result.images.svg.includes('class="requirement-cutoff"'));
  assert.ok(result.images.svg.includes('class="requirement-winner"'));
  assert.ok(result.citations.entries.some(e => e.doi === doi));
  count ??= result.point_count;
  assert.equal(result.point_count, count, "Cutoffs must not change the context cohort");
}
const empty = await request({ minimum_x: 1e6 });
assert.equal(empty.requirement.qualifying_count, 0);
assert.equal(empty.requirement.best, null);
assert.equal(empty.top_points.length, 0);
assert.ok(empty.images.svg.includes("No reported pair meets this requirement"));
assert.ok(!empty.images.svg.includes("NaN"));
const huge = await request({ minimum_x: 1e308 });
assert.equal(huge.requirement.qualifying_count, 0);
assert.ok(!/NaN|Infinity/.test(huge.images.svg));
const ashby = await request({ kind: "ashby", minimum_x: 2, formats: ["svg", "png", "pdf"], temporary: {x:1,y:2,label:"Candidate"} });
assert.equal(ashby.requirement.temporary_meets_requirement, false);
assert.ok(Buffer.from(ashby.images.pdf_base64, "base64").subarray(0,4).equals(Buffer.from("%PDF")));
assert.ok(Buffer.from(ashby.images.png_base64, "base64").subarray(1,4).equals(Buffer.from("PNG")));
assert.ok(!ashby.images.svg.includes("NaN"));
for (const minimum_x of [-1, null, true, "2"]) await request({ minimum_x }, 400);
for (const show_callouts of [null, 0, "false"]) await request({show_callouts}, 400);
await request({ kind: "trend", minimum_x: 2 }, 400);
await request({ kind: "ranked", minimum_x: 2 }, 400);
await request({ y:"density", minimum_x:2 }, 400);
console.log("Requirement regression checks passed: cutoffs, inclusivity, full paired cohort, exports, citations, empty state and input validation.");
