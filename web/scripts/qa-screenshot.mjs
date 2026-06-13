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
if (!exportedSvg.includes("<style>") || !exportedSvg.includes(".plot-area") || exportedSvg.includes("plot-watermark")) {
  throw new Error("Exported SVG is not standalone or still contains the watermark.");
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
await page.getByRole("tab", { name: "Scatter" }).click();
await page.screenshot({ path: path.join(outDir, "desktop.png"), fullPage: true });
const desktopInfo = await page.evaluate(() => ({
  title: document.title,
  plotPoints: document.querySelectorAll(".plot-point").length,
  citationModalClosed: !document.querySelector('[role="dialog"]'),
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  width: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: document.documentElement.clientHeight,
  scrollHeight: document.documentElement.scrollHeight
}));

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
      rankedInfo,
      trendInfo,
      mobileInfo,
  screenshots: [
    path.join(outDir, "desktop.png"),
    path.join(outDir, "citation-modal.png"),
    path.join(outDir, "export-modal.png"),
    path.join(outDir, "exported-figure.svg"),
    path.join(outDir, "submission-invalid-doi.png"),
    path.join(outDir, "ranked.png"),
    path.join(outDir, "trend.png"),
    path.join(outDir, "mobile.png")
  ]
    },
    null,
    2
  )
);
