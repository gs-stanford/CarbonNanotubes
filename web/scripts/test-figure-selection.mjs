import assert from "node:assert/strict";

const baseUrl = (process.env.CPT_TEST_URL ?? "http://localhost:3001").replace(/\/$/, "");

async function requestFigure(body) {
  const response = await fetch(`${baseUrl}/api/v1/figures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "scatter", formats: ["svg"], top: 0, ...body })
  });
  assert.equal(response.status, 200, `Figure endpoint returned HTTP ${response.status}`);
  return response.json();
}

function calloutsFrom(svg) {
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
        leaderLength: Math.hypot(leaderX - pointX, leaderY - pointY),
        x0,
        y0,
        x1: x0 + width,
        y1: y0 + 16
      };
    }
  );
}

function validateCallouts(figure, label, requiredMetals = []) {
  const svg = figure.images.svg;
  assert.ok(svg.includes("<svg"));
  assert.ok(figure.point_count > 0);
  const callouts = calloutsFrom(svg);

  for (const metal of requiredMetals) {
    assert.equal(
      callouts.filter((callout) => callout.text === metal).length,
      1,
      `${label}: ${metal} must have exactly one benchmark callout.`
    );
  }
  for (const callout of callouts) {
    assert.ok(callout.leaderLength >= 5, `${label}: '${callout.text}' label covers its own marker.`);
  }
  for (let index = 0; index < callouts.length; index += 1) {
    for (let other = index + 1; other < callouts.length; other += 1) {
      const a = callouts[index];
      const b = callouts[other];
      const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      assert.equal(overlap, false, `${label}: callouts overlap: '${a.text}' and '${b.text}'.`);
    }
  }
  return callouts;
}

const specificFigure = await requestFigure({
  x: "specific_strength",
  y: "specific_electrical_conductivity",
  x_scale: "log",
  y_scale: "log",
  filters: {}
});
const specificCallouts = validateCallouts(
  specificFigure,
  "specific conductivity vs specific strength",
  ["Al", "Cu", "Ag", "Au", "Ni", "Steel"]
);

const tensileFigure = await requestFigure({
  x: "tensile_strength",
  y: "specific_electrical_conductivity",
  x_scale: "linear",
  y_scale: "linear",
  filters: {
    material_family: [
      "carbon_fiber_comparator",
      "CNT_or_CNT_hybrid",
      "CNT_metal_composite",
      "graphene_or_GO_fiber",
      "metal_comparator"
    ]
  }
});
const tensileCallouts = validateCallouts(
  tensileFigure,
  "specific conductivity vs tensile strength",
  ["Al", "Cu"]
);

const longestLeader = Math.max(
  ...specificCallouts.map((callout) => callout.leaderLength),
  ...tensileCallouts.map((callout) => callout.leaderLength)
);
console.log(
  `Figure-selection regression passed: ${specificFigure.point_count + tensileFigure.point_count} points, `
  + `${specificCallouts.length + tensileCallouts.length} clear callouts, longest leader ${longestLeader.toFixed(1)} px.`
);
