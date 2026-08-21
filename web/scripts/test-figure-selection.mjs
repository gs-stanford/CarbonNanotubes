import assert from "node:assert/strict";

const baseUrl = (process.env.CPT_TEST_URL ?? "http://localhost:3001").replace(/\/$/, "");
const response = await fetch(`${baseUrl}/api/v1/figures`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    kind: "scatter",
    x: "specific_strength",
    y: "specific_electrical_conductivity",
    x_scale: "log",
    y_scale: "log",
    formats: ["svg"],
    top: 0,
    filters: {}
  })
});
assert.equal(response.status, 200, `Figure endpoint returned HTTP ${response.status}`);

const figure = await response.json();
const svg = figure.images.svg;
assert.ok(svg.includes("<svg"));
assert.ok(figure.point_count > 0);

const callouts = Array.from(
  svg.matchAll(/<text class="point-label" x="([^"]+)" y="([^"]+)">([^<]+)<\/text>/g),
  (match) => {
    const text = match[3];
    const x0 = Number(match[1]);
    const y0 = Number(match[2]) - 11;
    const width = Math.min(Math.max(text.length * 5.7 + 4, 32), 210);
    return { text, x0, y0, x1: x0 + width, y1: y0 + 16 };
  }
);

for (const metal of ["Al", "Cu", "Ag", "Au", "Ni", "Steel"]) {
  assert.equal(
    callouts.filter((callout) => callout.text === metal).length,
    1,
    `${metal} must have exactly one benchmark callout.`
  );
}
for (let index = 0; index < callouts.length; index += 1) {
  for (let other = index + 1; other < callouts.length; other += 1) {
    const a = callouts[index];
    const b = callouts[other];
    const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    assert.equal(overlap, false, `Callouts overlap: '${a.text}' and '${b.text}'.`);
  }
}

console.log(`Figure-selection regression passed: ${figure.point_count} points, ${callouts.length} non-overlapping callouts.`);
