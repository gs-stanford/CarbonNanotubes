import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.env.CPT_TEST_URL ?? "http://localhost:3003";
const output = process.env.CPT_QA_OUTPUT_DIR;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CPT_CHROME_PATH
  ?? (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined) });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(base);
      await page.locator(".plot-point").first().waitFor();
      const button = page.getByRole("button", { name: "Download Figure", exact: true });
      const controls = page.getByRole("group", { name: "Figure type and download", exact: true });
      assert.equal(await button.count(), 1);
      assert.equal(await page.locator(".atlas-header").getByRole("button", { name: "Download Figure", exact: true }).count(), 0);
      assert.equal(await controls.getByRole("button", { name: "Download Figure", exact: true }).count(), 1);
      assert.equal(await page.getByRole("group", { name: "Figure controls", exact: true }).getByRole("checkbox", { name: "Point callouts", exact: true }).count(), 1);
      assert.equal(await controls.getByRole("tab").count(), 4);
      assert.equal(await controls.getByRole("tablist").getByRole("button", { name: "Download Figure", exact: true }).count(), 0);
      const buttonBox = await button.boundingBox();
      const ashbyBox = await controls.getByRole("tab", { name: "Ashby", exact: true }).boundingBox();
      if (viewport.width > 560) {
        assert.ok(buttonBox.x > ashbyBox.x + ashbyBox.width, "Download belongs immediately after Ashby");
        assert.ok(Math.abs(buttonBox.y - ashbyBox.y) < 2, "Download aligns with the figure tabs");
      }
      const figureBox = await page.locator("#property-figure").boundingBox();
      assert.ok(buttonBox.y + buttonBox.height <= figureBox.y, "Download belongs above the figure");
      assert.ok(buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= viewport.width, "Download must fit the viewport");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No horizontal page overflow");
      if (output) await page.screenshot({ path: path.join(output, `figure-actions-${viewport.width}.png`), fullPage: true });
      await button.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Download figure and citations" });
      await dialog.waitFor();
      for (const name of ["Download all four figures", "Download SVG", "Download PDF", "Download PNG", "Download top 10 table"]) {
        assert.equal(await dialog.getByRole("button", { name, exact: true }).isEnabled(), true);
      }
      await dialog.getByRole("button", { name: "Close export" }).click();
      await dialog.waitFor({ state: "hidden" });
      console.log(`${viewport.width}px: plot controls, keyboard opening, export options and responsive bounds passed`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
