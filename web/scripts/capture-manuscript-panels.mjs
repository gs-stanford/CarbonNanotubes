import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";


const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const target = process.env.CPT_CAPTURE_URL ?? "https://carbonnanotubes.onrender.com";
const outDir = path.resolve(
  process.env.CPT_CAPTURE_DIR ?? "qa/manuscript-panels"
);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  deviceScaleFactor: 2
});
const page = await context.newPage();

async function waitForFigureReady() {
  // State updates are debounced by 80 ms, so wait past the debounce before
  // accepting an already-rendered figure as the response to a new control.
  await page.waitForTimeout(150);
  await page.waitForFunction(() => {
    const figure = document.querySelector(".plot-figure");
    return figure?.getAttribute("aria-busy") === "false"
      && !figure.querySelector(".figure-status")
      && figure.querySelectorAll(".plot-point").length > 0;
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
}

await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".plot-point", { state: "attached", timeout: 20000 });
await waitForFigureReady();

const scaleRows = page.locator(".axis-section .scale-row");
for (const index of [0, 1]) {
  const logButton = scaleRows.nth(index).getByRole("button", { name: "Log" });
  if (await logButton.isEnabled()) {
    await logButton.click();
    await waitForFigureReady();
  }
}

await page.screenshot({
  path: path.join(outDir, "workspace.png"),
  fullPage: false
});

await page.screenshot({
  path: path.join(outDir, "query-controls.png"),
  clip: { x: 0, y: 62, width: 266, height: 930 }
});

await page.screenshot({
  path: path.join(outDir, "selected-point.png"),
  clip: { x: 1268, y: 62, width: 332, height: 930 }
});

await page.getByRole("button", { name: "How to cite" }).click();
const citationDialog = page.getByRole("dialog", {
  name: "Citations for the current figure"
});
await citationDialog.waitFor({ state: "visible", timeout: 10000 });
await citationDialog.locator(".citation-card").screenshot({
  path: path.join(outDir, "citation-dialog.png")
});
await page.getByRole("button", { name: "Close citation tool" }).click();

await page.getByRole("button", { name: "Download Figure", exact: true }).click();
const exportDialog = page.getByRole("dialog", {
  name: "Download figure and citations"
});
await exportDialog.waitFor({ state: "visible", timeout: 10000 });
await exportDialog.locator(".citation-card").screenshot({
  path: path.join(outDir, "export-dialog.png")
});
await page.getByRole("button", { name: "Close export" }).click();

await page.getByRole("button", { name: "Submit data", exact: true }).click();
const submissionDialog = page.getByRole("dialog", {
  name: "Submit data for curator review"
});
await submissionDialog.waitFor({ state: "visible", timeout: 10000 });
const submissionCard = submissionDialog.locator(".submit-card");
await submissionCard.evaluate((element) => {
  element.scrollTop = 0;
});
await page.waitForTimeout(200);
await submissionCard.screenshot({
  path: path.join(outDir, "submission-dialog.png")
});

await context.close();
await browser.close();

console.log(JSON.stringify({ target, outDir }, null, 2));
