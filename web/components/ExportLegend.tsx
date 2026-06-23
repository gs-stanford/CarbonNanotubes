"use client";

import type { PlotRecord } from "@/lib/data";

type LegendItem = {
  key: string;
  label: string;
  className: string;
  shape?: "circle" | "open-circle" | "square" | "diamond" | "triangle" | "down-triangle" | "hexagon";
};

type PositionedLegendItem = LegendItem & {
  x: number;
  y: number;
};

type ExportLegendProps = {
  records: PlotRecord[];
  width: number;
  y: number;
};

const LEGEND_LEFT = 92;
const LEGEND_ITEM_START = 184;
const LEGEND_RIGHT_PAD = 34;
const ROW_GAP = 17;

const MATERIAL_ITEMS = [
  { key: "carbon_fiber_comparator", label: "Carbon fiber", className: "point-material-carbon-fiber" },
  { key: "ceramic_or_glass_comparator", label: "Ceramic / glass", className: "point-material-ceramic" },
  { key: "CNT_or_CNT_hybrid", label: "CNT", className: "point-material-cnt" },
  { key: "CNT_metal_composite", label: "CNT-metal composite", className: "point-material-cnt-metal" },
  { key: "graphene_or_GO_fiber", label: "Graphene / graphite", className: "point-material-graphene" },
  { key: "metal_comparator", label: "Metal", className: "point-material-metal" },
  { key: "other_carbon_comparator", label: "Other carbon", className: "point-material-other-carbon" },
  { key: "polymer_fiber_comparator", label: "Polymer", className: "point-material-polymer" }
];

const FORM_ITEMS = [
  { key: "buckypaper", label: "Buckypaper", className: "point-shape-square", shape: "square" as const },
  { key: "fiber_yarn", label: "Fiber / yarn", className: "point-shape-circle", shape: "circle" as const },
  { key: "foam_aerogel", label: "Foam / aerogel", className: "point-shape-open-circle", shape: "open-circle" as const },
  { key: "forest_array", label: "Forest / array", className: "point-shape-triangle", shape: "triangle" as const },
  { key: "individual_nanotube_or_bundle", label: "Individual tube / bundle", className: "point-shape-diamond", shape: "diamond" as const },
  { key: "sheet_mat_film", label: "Sheet / mat / film", className: "point-shape-down-triangle", shape: "down-triangle" as const },
  { key: "bulk", label: "Bulk", className: "point-shape-hexagon", shape: "hexagon" as const }
];

function countBy(records: PlotRecord[], field: "material_family" | "form_factor"): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = record[field];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function itemWidth(item: LegendItem): number {
  return Math.min(190, Math.max(72, 30 + item.label.length * 5.2));
}

function layoutItems(items: LegendItem[], y: number, maxX: number): { items: PositionedLegendItem[]; nextY: number } {
  const positioned: PositionedLegendItem[] = [];
  let x = LEGEND_ITEM_START;
  let rowY = y;

  for (const item of items) {
    const width = itemWidth(item);
    if (x > LEGEND_ITEM_START && x + width > maxX) {
      x = LEGEND_ITEM_START;
      rowY += ROW_GAP;
    }
    positioned.push({ ...item, x, y: rowY });
    x += width;
  }

  return { items: positioned, nextY: rowY + ROW_GAP };
}

function compactLabel(value: string): string {
  return value.length > 29 ? `${value.slice(0, 26)}...` : value;
}

function LegendSymbol({ item, x, y, kind }: { item: LegendItem; x: number; y: number; kind: "material" | "form" }) {
  const symbolClass = `export-legend-symbol export-legend-${kind} ${item.className}`;
  const shape = item.shape ?? "circle";
  const size = 4.6;

  if (shape === "square") {
    return <rect className={symbolClass} x={x - size} y={y - size} width={size * 2} height={size * 2} rx={0.5} />;
  }
  if (shape === "diamond") {
    return <polygon className={symbolClass} points={`${x},${y - size * 1.2} ${x + size * 1.2},${y} ${x},${y + size * 1.2} ${x - size * 1.2},${y}`} />;
  }
  if (shape === "triangle") {
    return <polygon className={symbolClass} points={`${x},${y - size * 1.15} ${x - size},${y + size * 0.78} ${x + size},${y + size * 0.78}`} />;
  }
  if (shape === "down-triangle") {
    return <polygon className={symbolClass} points={`${x},${y + size * 1.15} ${x - size},${y - size * 0.78} ${x + size},${y - size * 0.78}`} />;
  }
  if (shape === "hexagon") {
    return <polygon className={symbolClass} points={`${x - size},${y - size * 0.72} ${x},${y - size} ${x + size},${y - size * 0.72} ${x + size},${y + size * 0.72} ${x},${y + size} ${x - size},${y + size * 0.72}`} />;
  }
  return <circle className={symbolClass} cx={x} cy={y} r={size} />;
}

export function ExportLegend({ records, width, y }: ExportLegendProps) {
  const maxX = width - LEGEND_RIGHT_PAD;
  const materialCounts = countBy(records, "material_family");
  const formCounts = countBy(records, "form_factor");
  const materialItems = MATERIAL_ITEMS.filter((item) => (materialCounts.get(item.key) ?? 0) > 0);
  const formItems = FORM_ITEMS.filter((item) => (formCounts.get(item.key) ?? 0) > 0);
  const materialLayout = layoutItems(materialItems, y, maxX);
  const formY = materialLayout.nextY + 4;
  const formLayout = layoutItems(formItems, formY, maxX);
  const legendHeight = Math.max(52, formLayout.nextY - y + 12);

  if (!materialItems.length && !formItems.length) return null;

  return (
    <g className="export-legend" data-export-padding={legendHeight}>
      {materialItems.length ? (
        <>
          <text x={LEGEND_LEFT} y={y + 4} className="export-legend-heading">
            Material family
          </text>
          {materialLayout.items.map((item) => (
            <g key={`export-material-${item.key}`} className="export-legend-item">
              <LegendSymbol item={item} x={item.x + 5} y={item.y} kind="material" />
              <text x={item.x + 17} y={item.y + 3.8} className="export-legend-text">
                {compactLabel(item.label)}
              </text>
            </g>
          ))}
        </>
      ) : null}
      {formItems.length ? (
        <>
          <text x={LEGEND_LEFT} y={formY + 4} className="export-legend-heading">
            Form factor
          </text>
          {formLayout.items.map((item) => (
            <g key={`export-form-${item.key}`} className="export-legend-item">
              <LegendSymbol item={item} x={item.x + 5} y={item.y} kind="form" />
              <text x={item.x + 17} y={item.y + 3.8} className="export-legend-text">
                {compactLabel(item.label)}
              </text>
            </g>
          ))}
        </>
      ) : null}
    </g>
  );
}
