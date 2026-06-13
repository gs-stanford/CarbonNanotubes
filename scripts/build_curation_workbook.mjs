import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(import.meta.dirname, "..");
const curationDir = path.join(root, "data", "curation");
const payloadPath = path.join(curationDir, "workbook_payload.json");
const outputPath = path.join(curationDir, "cnt_property_curation_workbook.xlsx");

const payload = JSON.parse(await fs.readFile(payloadPath, "utf8"));

function colName(indexZeroBased) {
  let n = indexZeroBased + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function rangeAddress(rowCount, colCount) {
  return `A1:${colName(colCount - 1)}${rowCount}`;
}

function safeSheetName(name) {
  return name.slice(0, 31).replace(/[\\/?*[\]:]/g, " ");
}

function tableName(name) {
  return `${name.replace(/[^A-Za-z0-9]/g, "")}Table`.slice(0, 240);
}

const workbook = Workbook.create();

for (const [sheetNameRaw, rows] of Object.entries(payload.sheets)) {
  const sheetName = safeSheetName(sheetNameRaw);
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;

  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const next = row.slice();
    while (next.length < colCount) next.push(null);
    return next;
  });

  const dataRange = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  dataRange.values = padded;
  dataRange.format.font = { name: "Aptos", size: 10, color: "#1F2937" };
  dataRange.format.wrapText = true;
  dataRange.format.borders = { preset: "all", style: "thin", color: "#E5E7EB" };

  const header = sheet.getRangeByIndexes(0, 0, 1, colCount);
  header.format.fill = { color: "#111827" };
  header.format.font = { bold: true, color: "#FFFFFF", name: "Aptos", size: 10 };
  header.format.rowHeightPx = 28;

  if (rowCount > 1 && colCount > 1) {
    sheet.tables.add(rangeAddress(rowCount, colCount), true, tableName(sheetName));
  }

  sheet.freezePanes.freezeRows(1);
  if (sheetName === "Review Queue") {
    sheet.freezePanes.freezeColumns(5);
  }

  const used = sheet.getRangeByIndexes(0, 0, rowCount, colCount);
  used.format.rowHeightPx = 24;

  const widthBySheet = {
    README: 260,
    "Review Queue": 135,
    "Publication Queue": 150,
    "Issue Summary": 180,
    "Property Coverage": 140,
    "Validation Summary": 170,
    "Dropdown Values": 170,
  };
  const defaultWidth = widthBySheet[sheetName] ?? 140;
  for (let col = 0; col < colCount; col += 1) {
    const colRange = sheet.getRangeByIndexes(0, col, rowCount, 1);
    colRange.format.columnWidthPx = defaultWidth;
  }

  if (sheetName === "Review Queue") {
    sheet.getRange("A:A").format.columnWidthPx = 150;
    sheet.getRange("B:B").format.columnWidthPx = 95;
    sheet.getRange("C:E").format.columnWidthPx = 110;
    sheet.getRange("F:F").format.columnWidthPx = 220;
    sheet.getRange("U:U").format.columnWidthPx = 260;
    sheet.getRange("X:Z").format.columnWidthPx = 200;
    sheet.getRange("AA:AC").format.columnWidthPx = 160;
    sheet.getRange("BH:BH").format.columnWidthPx = 320;

    if (rowCount > 1) {
      const lastRow = rowCount;
      sheet.getRange(`A2:A${lastRow}`).dataValidation = {
        rule: { type: "list", values: ["needs_review", "accept", "reject", "merge_duplicate", "needs_source_lookup"] },
      };
      sheet.getRange(`B2:B${lastRow}`).dataValidation = {
        rule: { type: "list", values: ["", "Yes", "No"] },
      };
      sheet.getRange(`E2:E${lastRow}`).dataValidation = {
        rule: { type: "list", values: ["", "1", "2", "3", "4", "5"] },
      };
      sheet.getRange(`G2:G${lastRow}`).dataValidation = {
        rule: { type: "list", values: ["CNT_or_CNT_hybrid", "graphene_or_GO_fiber", "CNT_metal_composite", "carbon_fiber_comparator", "polymer_fiber_comparator", "metal_comparator", "ceramic_or_glass_comparator"] },
      };
      sheet.getRange(`H2:H${lastRow}`).dataValidation = {
        rule: { type: "list", values: ["fiber_yarn", "sheet_mat_film", "buckypaper", "foam_aerogel", "forest_array", "unknown"] },
      };
    }
  }

  if (sheetName === "Publication Queue" && rowCount > 1) {
    sheet.getRange("A:A").format.columnWidthPx = 150;
    sheet.getRange("C:C").format.columnWidthPx = 190;
    sheet.getRange("E:E").format.columnWidthPx = 360;
    sheet.getRange("G:G").format.columnWidthPx = 200;
    sheet.getRange("S:S").format.columnWidthPx = 210;
    sheet.getRange("U:U").format.columnWidthPx = 360;
  }

  if (sheetName === "Issue Summary") {
    sheet.getRange("D:D").format.columnWidthPx = 520;
    sheet.getRange("A:D").format.rowHeightPx = 42;
  }

  if (sheetName === "README") {
    sheet.getRange("B:B").format.columnWidthPx = 640;
    sheet.getRange("A:B").format.rowHeightPx = 38;
  }
}

const inspect = await workbook.inspect({
  kind: "sheet,table",
  include: "id,name",
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 8,
});
console.log(inspect.ndjson);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(JSON.stringify({ outputPath }, null, 2));
