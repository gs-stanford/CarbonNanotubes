import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3005";
const output = process.env.CPT_TEST_OUTPUT;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CPT_CHROME_PATH });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    await page.locator(".plot-point").first().waitFor();
    if (viewport.width < 600) await page.getByRole("button", { name: "Properties & filters" }).click();
    const crystal = page.getByRole("checkbox", { name: /Graphite crystal \/ HOPG/ });
    const device = page.getByRole("checkbox", { name: /Micro \/ nanoscale device/ });
    assert.equal(await crystal.isChecked(), false);
    assert.equal(await device.isChecked(), false);
    assert.equal(await page.getByRole("checkbox", { name: /Individual tube \/ bundle/ }).isChecked(), false);
    assert.equal(await page.locator('[data-record-id="rec_7a9c079963dd"]').count(), 0);
    await page.locator("#x-property").selectOption("electrical_conductivity");
    await page.locator("#y-property").selectOption("thermal_conductivity");
    await device.check();
    if (viewport.width < 600) await page.getByRole("button", { name: "Hide filters" }).click();
    await page.locator('[data-record-id="rec_170355132b02"]').waitFor();
    await page.locator('[data-record-id="rec_170355132b02"]').click();
    const details = page.locator("#point-details");
    await details.getByText("Source estimate", { exact: true }).waitFor();
    assert.match(await details.innerText(), /Micro \/ nanoscale device/);
    assert.match(await details.innerText(), /Heat-breakdown model estimate/);
    assert.equal(await details.locator("details").first().getAttribute("open"), "");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "No horizontal page overflow");
    if (output) await page.screenshot({ path: path.join(output, `specimen-details-${viewport.width}.png`), fullPage: true });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Desktop/mobile UI passed: references opt-in, nanoribbon selection, visible source-estimate label and expanded qualification, no horizontal overflow or page errors.");
} finally {
  await browser.close();
}
