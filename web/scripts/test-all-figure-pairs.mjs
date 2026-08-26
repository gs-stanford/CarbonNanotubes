import assert from "node:assert/strict";

const baseUrl = (process.env.CPT_TEST_URL ?? "http://localhost:3001").replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(Number(process.env.CPT_AUDIT_CONCURRENCY ?? 4), 8));

async function jsonResponse(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json();
  return { response, payload };
}

async function figure(body) {
  return jsonResponse("/api/v1/figures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function calloutBoxes(svg) {
  return Array.from(
    svg.matchAll(/<line class="label-leader" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"\/><text class="point-label" x="([^"]+)" y="([^"]+)"(?: text-anchor="[^"]+")?>([^<]+)<\/text>/g),
    (match) => {
      const text = match[7];
      const pointX = Number(match[1]);
      const pointY = Number(match[2]);
      const leaderX = Number(match[3]);
      const leaderY = Number(match[4]);
      const x0 = Number(match[5]);
      const y0 = Number(match[6]) - 11;
      const width = Math.min(Math.max(text.length * 5.7 + 4, 32), 210);
      return {
        text,
        pointX,
        pointY,
        leaderLength: Math.hypot(leaderX - pointX, leaderY - pointY),
        x0,
        y0,
        x1: x0 + width,
        y1: y0 + 16
      };
    }
  );
}

function validateCallouts(svg, label) {
  const callouts = calloutBoxes(svg);
  for (const metal of ["Al", "Cu", "Ag", "Au", "Ni", "Steel"]) {
    assert.ok(callouts.filter((item) => item.text === metal).length <= 1, `${label}: duplicate ${metal} callout`);
  }
  for (const callout of callouts) {
    assert.ok(callout.leaderLength >= 5, `${label}: '${callout.text}' label covers its own marker`);
  }
  for (let index = 0; index < callouts.length; index += 1) {
    for (let other = index + 1; other < callouts.length; other += 1) {
      const a = callouts[index];
      const b = callouts[other];
      const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      assert.equal(overlap, false, `${label}: callouts overlap: '${a.text}' and '${b.text}'`);
    }
  }
}

function validateFigure(payload, request) {
  const label = `${request.kind}:${request.x}:${request.y}`;
  assert.equal(payload.kind, request.kind, `${label}: kind mismatch`);
  assert.ok(payload.point_count > 0, `${label}: empty successful figure`);
  assert.equal(payload.point_count, payload.record_ids.length, `${label}: point/ID count mismatch`);
  assert.equal(new Set(payload.record_ids).size, payload.record_ids.length, `${label}: duplicate record IDs`);
  assert.ok(payload.images.svg.includes("<svg"), `${label}: missing SVG`);
  assert.ok(!/\b(?:NaN|Infinity)\b/.test(payload.images.svg), `${label}: nonfinite SVG coordinate`);
  assert.ok(!payload.images.svg.includes("data-record-id="), `${label}: exported SVG leaks record IDs`);
  assert.ok(!payload.images.svg.includes("plot-watermark"), `${label}: exported SVG contains watermark`);
  validateCallouts(payload.images.svg, label);
}

async function worker(queue, results) {
  while (queue.length) {
    const request = queue.shift();
    const { response, payload } = await figure(request);
    const label = `${request.kind}:${request.x}:${request.y}`;
    if (response.status === 400 && /No records match|No positive records remain/.test(payload.error?.message ?? "")) {
      results.unsupported.push(label);
      continue;
    }
    assert.equal(response.status, 200, `${label}: HTTP ${response.status}: ${payload.error?.message ?? "unknown error"}`);
    validateFigure(payload, request);
    results.passed.push({ label, points: payload.point_count });
  }
}

const { response: propertiesResponse, payload: propertiesPayload } = await jsonResponse("/api/v1/properties");
assert.equal(propertiesResponse.status, 200);
const keys = propertiesPayload.properties.map((property) => property.key);
assert.ok(keys.length > 1);

const requests = [];
for (let xIndex = 0; xIndex < keys.length; xIndex += 1) {
  for (let yIndex = xIndex + 1; yIndex < keys.length; yIndex += 1) {
    for (const kind of ["scatter", "ashby"]) {
      requests.push({ kind, x: keys[xIndex], y: keys[yIndex], formats: ["svg"], top: 0, filters: {} });
    }
  }
}
for (const y of keys) {
  const x = keys.find((candidate) => candidate !== y);
  for (const kind of ["ranked", "trend"]) {
    requests.push({ kind, x, y, formats: ["svg"], top: 0, filters: {} });
  }
}

const results = { passed: [], unsupported: [] };
const queue = requests.slice();
await Promise.all(Array.from({ length: concurrency }, () => worker(queue, results)));
assert.ok(results.passed.some((item) => item.label.startsWith("scatter:")), "No scatter pair passed.");
assert.ok(results.passed.some((item) => item.label.startsWith("ashby:")), "No Ashby pair passed.");
assert.ok(results.passed.some((item) => item.label.startsWith("ranked:")), "No ranked property passed.");
assert.ok(results.passed.some((item) => item.label.startsWith("trend:")), "No trend property passed.");

const temporaryRequest = {
  kind: "scatter",
  x: "specific_strength",
  y: "specific_electrical_conductivity",
  x_scale: "log",
  y_scale: "log",
  top: 5,
  top_by: "y",
  temporary: { x: 1.8, y: 12, label: "Audit candidate" },
  formats: ["svg", "png", "pdf"],
  filters: { material_family: ["CNT_or_CNT_hybrid", "CNT_metal_composite"], peer_reviewed: true }
};
const { response: temporaryResponse, payload: temporaryPayload } = await figure(temporaryRequest);
assert.equal(temporaryResponse.status, 200, temporaryPayload.error?.message);
validateFigure(temporaryPayload, temporaryRequest);
assert.ok(temporaryPayload.images.svg.includes('class="temporary-point"'), "Temporary marker is missing from SVG.");
assert.equal(temporaryPayload.temporary_point.label, "Audit candidate");
assert.equal(temporaryPayload.temporary_point.total_with_temporary, temporaryPayload.point_count + 1);
for (const key of ["x_rank", "y_rank", "dominated_by"]) assert.ok(Number.isInteger(temporaryPayload.temporary_point[key]));
for (const key of ["x_percentile", "y_percentile"]) {
  assert.ok(temporaryPayload.temporary_point[key] >= 0 && temporaryPayload.temporary_point[key] <= 100);
}
assert.equal(typeof temporaryPayload.temporary_point.on_pareto_frontier, "boolean");
assert.ok(temporaryPayload.top_points.length > 0 && temporaryPayload.top_points.length <= 5);
assert.ok(temporaryPayload.top_points.every((row, index) => row.rank === index + 1 && row.citation));
assert.ok(Buffer.from(temporaryPayload.images.png_base64, "base64").subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")));
assert.equal(Buffer.from(temporaryPayload.images.pdf_base64, "base64").subarray(0, 4).toString("ascii"), "%PDF");

for (const [axis, temporary] of [["x", { x: 0, y: 12 }], ["y", { x: 1.8, y: 0 }]]) {
  const { response, payload } = await figure({ ...temporaryRequest, formats: ["svg"], top: 0, temporary });
  assert.equal(response.status, 400, `Nonpositive log-${axis} temporary point was accepted.`);
  assert.match(payload.error.message, new RegExp(`temporary ${axis} must be positive`));
}

console.log(JSON.stringify({
  status: "passed",
  property_count: keys.length,
  requests_checked: requests.length,
  supported_figures: results.passed.length,
  unsupported_combinations: results.unsupported.length,
  largest_figure: results.passed.sort((a, b) => b.points - a.points)[0],
  temporary_point: temporaryPayload.temporary_point,
  export_formats: Object.keys(temporaryPayload.images)
}, null, 2));
