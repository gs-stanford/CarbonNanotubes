import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3002";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CPT_CHROME_PATH
  ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  page.on("request", request => { if (request.method() === "POST") requests.push(new URL(request.url()).pathname); });
  await page.goto(base);
  await page.locator(".plot-point").first().waitFor();
  const svg = await page.locator(".server-figure-svg > svg").elementHandle();
  const figureCount = () => requests.filter(path => path === "/api/v1/figures").length;
  const detailCount = () => requests.filter(path => path === "/api/v1/figures/selection").length;
  const initial = figureCount();
  const points = await page.locator(".plot-point").evaluateAll(elements => elements.slice(0, 2).map(e => e.getAttribute("data-record-id")));
  for (const id of points) {
    await page.locator(`[data-record-id="${id}"]`).click();
    await page.locator("#point-details h3").waitFor();
    assert.equal(await page.locator(".plot-point.is-selected").getAttribute("data-record-id"), id);
    assert.equal(figureCount(), initial, "Selection must not generate a figure");
    assert.equal(await svg.evaluate(element => element === document.querySelector(".server-figure-svg > svg")), true, "Selection must retain the same SVG node");
  }
  const loaded = detailCount();
  await page.getByRole("button", { name: "Close point details" }).click();
  for (const id of points) {
    await page.locator(`[data-record-id="${id}"]`).click();
    await page.locator("#point-details h3").waitFor();
  }
  await page.waitForTimeout(150);
  assert.equal(detailCount(), loaded, "Reopening cached points must not request details");
  assert.equal(figureCount(), initial, "Closing/reopening must not generate a figure");
  const changed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/figures" && response.request().method() === "POST");
  await page.getByRole("checkbox", { name: "Point callouts", exact: true }).uncheck();
  await changed;
  assert.equal(figureCount(), initial + 1, "Plot settings must still generate a new figure");
  console.log("Point interaction passed: same SVG, local highlighting, no figure requests on selection/close, cached revisits, normal plot-setting updates.");
} finally {
  await browser.close();
}
