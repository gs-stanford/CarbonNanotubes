import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.CPT_TEST_URL ?? "http://127.0.0.1:3004";
const output = process.env.CPT_QA_OUTPUT_DIR;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CPT_CHROME_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const cases = [
    ...["scatter", "ranked", "trend", "ashby"].map(kind => ({ kind })),
    { kind: "scatter", x_scale: "linear", y_scale: "linear" },
    { kind: "ashby", minimum_x: 2, temporary: { x: 3, y: 12, label: "Candidate" } },
    { kind: "scatter", x: "electrical_conductivity", y: "thermal_conductivity" },
    { kind: "ashby", x: "electrical_conductivity", y: "thermal_conductivity" }
  ];
  for (const [index, options] of cases.entries()) {
    const response = await fetch(`${base}/api/v1/figures`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: "specific_strength", y: "specific_electrical_conductivity", x_scale: "log", y_scale: "log", formats: ["svg", "png", "pdf"], top: 1, ...options })
    });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    for (const [mode, svg] of [["display", result.display_svg], ["export", result.images.svg]]) {
      await page.setContent(svg);
      const geometry = await page.evaluate(() => {
        const rect = element => {
          const b = element.getBoundingClientRect();
          return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
        };
        const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        const legend = rect(document.querySelector(".export-legend-box"));
        const plot = rect(document.querySelector(".plot-area"));
        const texts = [...document.querySelectorAll(".export-legend text")].map(rect);
        return {
          legends: document.querySelectorAll(".export-legend").length,
          inside: legend.x0 >= plot.x0 && legend.x1 <= plot.x1 && legend.y0 >= plot.y0 && legend.y1 <= plot.y1,
          labelsFit: texts.every(b => b.x0 >= legend.x0 && b.x1 <= legend.x1 && b.y0 >= legend.y0 && b.y1 <= legend.y1),
          coveredPoints: [...document.querySelectorAll(".plot-point, .temporary-point, .point-label, .temporary-point-label")].filter(e => overlaps(legend, rect(e))).map(e => e.getAttribute("data-record-id") || e.textContent || e.getAttribute("class")),
          pointCount: document.querySelectorAll(".plot-point").length,
          topGapFraction: (Math.min(...[...document.querySelectorAll(".plot-point")].map(e => rect(e).y0)) - plot.y0) / (plot.y1 - plot.y0)
        };
      });
      assert.equal(geometry.legends, 1);
      assert.equal(geometry.inside, true, `${index} ${mode}: legend must be inside axes`);
      assert.equal(geometry.labelsFit, true, `${index} ${mode}: legend text must fit`);
      assert.deepEqual(geometry.coveredPoints, [], `${index} ${mode}: legend hides data or callouts`);
      assert.ok(geometry.pointCount > 0);
      if (index === 0 || index === 3) assert.ok(geometry.topGapFraction < 0.2, `${index}: default plot has excessive top headroom`);
      assert.ok(!/NaN|Infinity/.test(svg));
    }
    assert.equal(Buffer.from(result.images.pdf_base64, "base64").subarray(0, 4).toString(), "%PDF");
    assert.equal(Buffer.from(result.images.png_base64, "base64").subarray(1, 4).toString(), "PNG");
    if (output) {
      const stem = path.join(output, `${index}-${options.kind}`);
      await fs.writeFile(`${stem}.svg`, result.images.svg);
      await fs.writeFile(`${stem}.png`, Buffer.from(result.images.png_base64, "base64"));
      await fs.writeFile(`${stem}.pdf`, Buffer.from(result.images.pdf_base64, "base64"));
    }
    console.log(`${index} ${options.kind}: inset legend, markers, callouts, SVG/PNG/PDF passed`);
  }
} finally {
  await browser.close();
}
