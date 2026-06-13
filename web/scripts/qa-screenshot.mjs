import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const outDir = path.resolve("qa");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const target = process.env.QA_URL ?? "http://localhost:3000";

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 1,
  acceptDownloads: true
});
const page = await context.newPage();
await page.goto(target, { waitUntil: "networkidle", timeout: 30000 });
const howToCiteButton = page.getByRole("button", { name: "How to cite" });
await howToCiteButton.click();
const citationDialog = page.getByRole("dialog", { name: "Citations for the current figure" });
await citationDialog.waitFor({ state: "visible", timeout: 5000 });
await page.screenshot({ path: path.join(outDir, "citation-modal.png"), fullPage: true });
await page.getByRole("button", { name: "Close citation tool" }).click();
await citationDialog.waitFor({ state: "hidden", timeout: 5000 });
const exportButton = page.getByRole("button", { name: "Download Figure", exact: true });
await exportButton.click();
const exportDialog = page.getByRole("dialog", { name: "Download figure and citations" });
await exportDialog.waitFor({ state: "visible", timeout: 5000 });
const svgDownload = await Promise.all([
  page.waitForEvent("download", { timeout: 5000 }),
  page.getByRole("button", { name: "Download SVG" }).click()
]).then(([download]) => download);
const exportedSvgPath = path.join(outDir, "exported-figure.svg");
await svgDownload.saveAs(exportedSvgPath);
const exportedSvg = await fs.readFile(exportedSvgPath, "utf8");
if (
  !exportedSvg.includes("<style>") ||
  !exportedSvg.includes(".plot-area") ||
  !exportedSvg.includes("export-legend") ||
  !exportedSvg.includes("Color") ||
  !exportedSvg.includes("Shape") ||
  exportedSvg.includes("plot-watermark")
) {
  throw new Error("Exported SVG is not standalone or still contains the watermark.");
}
const viewBoxMatch = exportedSvg.match(/viewBox="([^"]+)"/);
const viewBoxHeight = viewBoxMatch ? Number(viewBoxMatch[1].trim().split(/\s+/)[3]) : 0;
if (!Number.isFinite(viewBoxHeight) || viewBoxHeight <= 560) {
  throw new Error(`Exported SVG viewBox was not expanded for the legend: ${viewBoxMatch?.[1] ?? "missing"}.`);
}
const pdfPopupPromise = page.waitForEvent("popup", { timeout: 5000 });
await page.getByRole("button", { name: "Save PDF" }).click();
const pdfPopup = await pdfPopupPromise;
await pdfPopup.waitForLoadState("load", { timeout: 5000 }).catch(() => {});
await pdfPopup.waitForTimeout(800);
const pdfSvgCount = await pdfPopup.locator("svg.plot-svg").count();
if (pdfSvgCount !== 1) {
  throw new Error(`PDF print view expected one exported SVG, found ${pdfSvgCount}.`);
}
await pdfPopup.close();
await page.screenshot({ path: path.join(outDir, "export-modal.png"), fullPage: true });
await page.getByRole("button", { name: "Close export" }).click();
await exportDialog.waitFor({ state: "hidden", timeout: 5000 });
const submitButton = page.getByRole("button", { name: "Submit data form" });
await submitButton.click();
const submitDialog = page.getByRole("dialog", { name: "Submit data for curator review" });
await submitDialog.waitFor({ state: "visible", timeout: 5000 });
await page.locator('input[name="doi"]').fill("not-a-doi");
await page.locator('input[name="sample_label"]').fill("QA invalid DOI sample");
await page.locator('input[name="measurement_specific_strength"]').fill("1.2");
await page.getByRole("button", { name: "Submit and plot" }).click();
await page.locator(".submit-output").waitFor({ state: "visible", timeout: 5000 });
const submitOutput = await page.locator(".submit-output").textContent();
if (!submitOutput?.includes("invalid_doi_format")) {
  throw new Error("Submission QA did not surface invalid_doi_format.");
}
await page.screenshot({ path: path.join(outDir, "submission-invalid-doi.png"), fullPage: true });
await page.getByRole("button", { name: "Close submit data" }).click();
await submitDialog.waitFor({ state: "hidden", timeout: 5000 });
await page.getByRole("tab", { name: "Ranked" }).click();
await page.screenshot({ path: path.join(outDir, "ranked.png"), fullPage: true });
const rankedInfo = await page.evaluate(() => ({
  plotPoints: document.querySelectorAll(".plot-point").length,
  rankRows: document.querySelectorAll(".rank-row-line").length,
  referenceLines: document.querySelectorAll(".rank-reference-line").length,
  legendText: document.querySelector(".encoding-legend")?.textContent?.replace(/\s+/g, " ").trim() ?? ""
}));
await page.getByRole("tab", { name: "Trend" }).click();
await page.screenshot({ path: path.join(outDir, "trend.png"), fullPage: true });
const trendInfo = await page.evaluate(() => ({
  plotPoints: document.querySelectorAll(".plot-point").length,
  trendLabels: document.querySelectorAll(".plot-label-group").length
}));
await page.getByRole("tab", { name: "Ashby" }).click();
await page.screenshot({ path: path.join(outDir, "ashby.png"), fullPage: true });
const ashbyInfo = await page.evaluate(() => ({
  title: document.querySelector(".plot-heading h2")?.textContent?.trim() ?? "",
  plotPoints: document.querySelectorAll(".plot-point").length,
  ashbyRegions: document.querySelectorAll(".ashby-region").length,
  minorGridLines: document.querySelectorAll(".minor-grid-line").length,
  largestRegionWidthFraction: Math.max(
    0,
    ...[...document.querySelectorAll(".ashby-region")].map((region) => {
      const box = region.getBBox();
      return box.width / (920 - 92 - 34);
    })
  ),
  sparseRegionCount: [...document.querySelectorAll(".ashby-region")].filter((region) => Number(region.getAttribute("data-total-count") ?? "0") < 8).length,
  labelOverlapCount: (() => {
    const labels = [...document.querySelectorAll(".point-label, .ashby-region-label")].map((label) => {
      const box = label.getBBox();
      return { x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height };
    });
    let overlaps = 0;
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        if (labels[i].x0 < labels[j].x1 && labels[i].x1 > labels[j].x0 && labels[i].y0 < labels[j].y1 && labels[i].y1 > labels[j].y0) overlaps += 1;
      }
    }
    return overlaps;
  })(),
  xLinearDisabled: Boolean([...document.querySelectorAll(".axis-section .scale-row")][0]?.querySelector("button:first-child")?.hasAttribute("disabled")),
  xLogDisabled: Boolean([...document.querySelectorAll(".axis-section .scale-row")][0]?.querySelector("button:last-child")?.hasAttribute("disabled")),
  yLinearDisabled: Boolean([...document.querySelectorAll(".axis-section .scale-row")][1]?.querySelector("button:first-child")?.hasAttribute("disabled")),
  yLogDisabled: Boolean([...document.querySelectorAll(".axis-section .scale-row")][1]?.querySelector("button:last-child")?.hasAttribute("disabled")),
  activeTab: document.querySelector('.plot-type-tabs .mode-button[aria-selected="true"]')?.textContent?.trim() ?? "",
  xScaleLogActive: [...document.querySelectorAll(".axis-section .scale-row")][0]?.querySelector(".is-active")?.textContent?.trim() ?? "",
  yScaleLogActive: [...document.querySelectorAll(".axis-section .scale-row")][1]?.querySelector(".is-active")?.textContent?.trim() ?? ""
}));
if (
  !ashbyInfo.title.includes("Ashby") ||
  ashbyInfo.plotPoints < 1 ||
  ashbyInfo.ashbyRegions < 1 ||
  ashbyInfo.minorGridLines < 1 ||
  ashbyInfo.largestRegionWidthFraction > 0.82 ||
  ashbyInfo.sparseRegionCount !== 0 ||
  ashbyInfo.labelOverlapCount !== 0 ||
  !ashbyInfo.xLinearDisabled ||
  !ashbyInfo.xLogDisabled ||
  !ashbyInfo.yLinearDisabled ||
  !ashbyInfo.yLogDisabled ||
  ashbyInfo.xScaleLogActive !== "Log" ||
  ashbyInfo.yScaleLogActive !== "Log" ||
  ashbyInfo.activeTab !== "Ashby"
) {
  throw new Error(`Ashby QA failed: ${JSON.stringify(ashbyInfo)}`);
}
await page.getByRole("tab", { name: "Scatter" }).click();
await page.screenshot({ path: path.join(outDir, "desktop.png"), fullPage: true });
const desktopInfo = await page.evaluate(() => ({
  title: document.title,
  plotPoints: document.querySelectorAll(".plot-point").length,
  radarRecordOptions: document.querySelectorAll("#radar-record option").length,
  radarPolygons: document.querySelectorAll(".radar-polygon").length,
  radarNodes: document.querySelectorAll(".radar-node").length,
  citationModalClosed: !document.querySelector('[role="dialog"]'),
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: document.documentElement.clientHeight,
  scrollHeight: document.documentElement.scrollHeight
}));
if (desktopInfo.radarRecordOptions !== 7 || desktopInfo.radarPolygons !== 1 || desktopInfo.radarNodes !== 6) {
  throw new Error(`Radar QA failed: ${JSON.stringify(desktopInfo)}`);
}
await page.locator("#radar-record").selectOption({ label: "T1100GC" });
const radarSourceLine = (await page.locator(".radar-record-card p").first().textContent()) ?? "";
if (/XiaO_DATA|\.xlsx/i.test(radarSourceLine)) {
  throw new Error(`Radar source line exposed an internal workbook filename: ${radarSourceLine}`);
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(target, { waitUntil: "networkidle", timeout: 30000 });
await page.screenshot({ path: path.join(outDir, "mobile.png"), fullPage: true });
const mobileInfo = await page.evaluate(() => ({
  plotPoints: document.querySelectorAll(".plot-point").length,
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: document.documentElement.clientHeight,
  scrollHeight: document.documentElement.scrollHeight
}));

await context.close();
await browser.close();

console.log(
  JSON.stringify(
    {
      target,
      desktopInfo,
      ashbyInfo,
      rankedInfo,
      trendInfo,
      mobileInfo,
  screenshots: [
    path.join(outDir, "desktop.png"),
    path.join(outDir, "citation-modal.png"),
    path.join(outDir, "export-modal.png"),
    path.join(outDir, "exported-figure.svg"),
    path.join(outDir, "submission-invalid-doi.png"),
    path.join(outDir, "ashby.png"),
    path.join(outDir, "ranked.png"),
    path.join(outDir, "trend.png"),
    path.join(outDir, "mobile.png")
  ]
    },
    null,
    2
  )
);
