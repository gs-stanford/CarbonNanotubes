import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(import.meta.dirname, "..");
const curationDir = path.join(root, "data", "curation");
const workbookPath = path.join(curationDir, "cnt_property_curation_workbook.xlsx");
const previewDir = path.join(curationDir, "previews");

await fs.mkdir(previewDir, { recursive: true });
const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "sheet,table",
  include: "id,name",
  maxChars: 8000,
  tableMaxRows: 3,
  tableMaxCols: 8,
});
console.log(overview.ndjson);

try {
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 300 },
    summary: "formula/value error scan",
  });
  console.log(errors.ndjson);
} catch (error) {
  console.log(JSON.stringify({ kind: "notice", message: "Formula/value error scan returned no matches or was skipped.", error: String(error).slice(0, 180) }));
}

const sheetNames = ["README", "Review Queue", "Publication Queue", "Issue Summary", "Property Coverage", "Validation Summary", "Dropdown Values"];
for (const sheetName of sheetNames) {
  try {
    const blob = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const out = path.join(previewDir, `${sheetName.replace(/[^A-Za-z0-9]+/g, "_")}.png`);
    await fs.writeFile(out, bytes);
  } catch (error) {
    console.log(JSON.stringify({ kind: "warning", sheetName, message: "Preview render skipped.", error: String(error).slice(0, 180) }));
  }
}

console.log(JSON.stringify({ workbookPath, previewDir }, null, 2));
