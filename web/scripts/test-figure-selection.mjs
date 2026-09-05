import assert from "node:assert/strict";
import { chromium } from "playwright-core";

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

async function calloutsFrom(svg) {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CPT_CHROME_PATH
    ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined)});
  try {
    const page = await browser.newPage();
    await page.setContent(svg.replace(/<\?xml[^>]*>/, ""));
    await page.evaluate(() => document.fonts.ready);
    return await page.locator(".point-label").evaluateAll(labels => labels.map(label => {
      const box = label.getBBox();
      const line = label.previousElementSibling;
      const pointX = Number(line.getAttribute("x1"));
      const pointY = Number(line.getAttribute("y1"));
      const leaderX = Number(line.getAttribute("x2"));
      const leaderY = Number(line.getAttribute("y2"));
      return {text:label.textContent, x0:box.x, y0:box.y, x1:box.x+box.width, y1:box.y+box.height,
        leaderLength:Math.hypot(leaderX-pointX, leaderY-pointY),
        gap:Math.hypot(Math.max(box.x-leaderX, 0, leaderX-box.x-box.width), Math.max(box.y-leaderY, 0, leaderY-box.y-box.height))};
    }));
  } finally { await browser.close(); }
}

async function validateCallouts(figure, label, requiredMetals = []) {
  const svg = figure.images.svg;
  assert.ok(svg.includes("<svg"));
  assert.ok(figure.point_count > 0);
  const callouts = await calloutsFrom(svg);
  assert.ok(callouts.length, `${label}: callout checks must not silently skip missing annotations`);

  for (const metal of requiredMetals) {
    assert.equal(
      callouts.filter((callout) => callout.text === metal).length,
      1,
      `${label}: ${metal} must have exactly one benchmark callout.`
    );
  }
  for (const callout of callouts) {
    assert.ok(callout.leaderLength >= 5, `${label}: '${callout.text}' label covers its own marker.`);
    assert.ok(callout.gap <= 5, `${label}: '${callout.text}' has a ${callout.gap.toFixed(1)} px gap from its leader.`);
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
const specificCallouts = await validateCallouts(
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
const tensileCallouts = await validateCallouts(
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
