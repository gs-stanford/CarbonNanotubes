import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { REFERENCE_FORM_GROUP } from "../lib/specimen-forms.mjs";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3005";
const output = process.env.CPT_TEST_OUTPUT;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CPT_CHROME_PATH });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    let lastFigure = null;
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", async response => {
      if (response.url().endsWith("/api/v1/figures") && response.ok()) lastFigure = await response.json();
    });
    await page.goto(base);
    await page.locator(".plot-point").first().waitFor();
    if (viewport.width < 600) await page.getByRole("button", { name: "Properties & filters" }).click();
    const references = page.getByRole("checkbox", { name: /Crystals & micro\/nanostructures/, includeHidden: true });
    assert.equal(await references.count(), 1);
    assert.equal(await references.isChecked(), false);
    assert.equal(await page.getByRole("checkbox", { name: /Graphite crystal \/ HOPG|Micro \/ nanoscale device|Individual tube \/ bundle/ }).count(), 0);
    assert.equal(await page.locator('[data-record-id="rec_7a9c079963dd"]').count(), 0);
    await page.locator("#x-property").selectOption("electrical_conductivity");
    await page.locator("#y-property").selectOption("thermal_conductivity");
    await references.check();
    if (viewport.width < 600) await page.getByRole("button", { name: "Hide filters" }).click();
    await page.locator('[data-record-id="rec_170355132b02"]').waitFor();
    assert.ok(REFERENCE_FORM_GROUP.forms.every(form => lastFigure?.request.filters.form_factor.includes(form)), "One checkbox selects all three precise forms");
    const referenceCount = REFERENCE_FORM_GROUP.forms.reduce((sum, form) => sum + (lastFigure.counts.form_factors[form] ?? 0), 0);
    assert.equal(await references.locator("..").locator(".count").innerText(), String(referenceCount));
    await page.locator('[data-record-id="rec_170355132b02"]').click();
    const details = page.locator("#point-details");
    await details.getByText("Source estimate", { exact: true }).waitFor();
    assert.match(await details.innerText(), /Micro \/ nanoscale device/);
    assert.match(await details.innerText(), /Heat-breakdown model estimate/);
    assert.equal(await details.locator("details").first().getAttribute("open"), "");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "No horizontal page overflow");
    if (output) await page.screenshot({ path: path.join(output, `specimen-details-${viewport.width}.png`), fullPage: true });
    if (viewport.width < 600) await page.getByRole("button", { name: "Properties & filters" }).click();
    await references.uncheck();
    await page.locator('[data-record-id="rec_170355132b02"]').waitFor({ state: "detached" });
    assert.ok(REFERENCE_FORM_GROUP.forms.every(form => !lastFigure?.request.filters.form_factor.includes(form)), "Turning the group off clears all three forms");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Desktop/mobile UI passed: references opt-in, nanoribbon selection, visible source-estimate label and expanded qualification, no horizontal overflow or page errors.");
} finally {
  await browser.close();
}
