#!/usr/bin/env python
"""Export all worksheet data from an OriginPro project.

Run this on Windows with Origin 2021+ installed:

    python scripts/export_origin_workbook.py "Data for Fig-6-Ashby plot.opju" exported_origin

The `originpro` package is a COM automation layer for Origin. It is not a
standalone OPJU parser and will not run on macOS without Origin.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd


def safe_name(value: str) -> str:
    value = value.strip() or "unnamed"
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value)
    return value.strip("._-") or "unnamed"


def export_project(project_path: Path, output_dir: Path) -> None:
    import originpro as op

    output_dir.mkdir(parents=True, exist_ok=True)
    tables_dir = output_dir / "tables"
    labels_dir = output_dir / "labels"
    graphs_dir = output_dir / "graphs"
    tables_dir.mkdir(exist_ok=True)
    labels_dir.mkdir(exist_ok=True)
    graphs_dir.mkdir(exist_ok=True)

    op.set_show(False)
    try:
        if not op.open(str(project_path), readonly=True):
            raise RuntimeError(f"Origin could not open project: {project_path}")

        manifest: list[dict[str, object]] = []

        for book_idx, book in enumerate(op.pages("w")):
            book_name = safe_name(getattr(book, "name", "") or f"Book{book_idx + 1}")
            book_lname = getattr(book, "lname", "")
            for sheet_idx, sheet in enumerate(book):
                sheet_name = safe_name(getattr(sheet, "name", "") or f"Sheet{sheet_idx + 1}")
                stem = f"{book_idx + 1:02d}_{book_name}__{sheet_idx + 1:02d}_{sheet_name}"

                df = sheet.to_df()
                csv_path = tables_dir / f"{stem}.csv"
                parquet_path = tables_dir / f"{stem}.parquet"
                df.to_csv(csv_path, index=False)
                df.to_parquet(parquet_path, index=False)

                labels = {
                    "book_index": book_idx,
                    "book_name": getattr(book, "name", ""),
                    "book_long_name": book_lname,
                    "sheet_index": sheet_idx,
                    "sheet_name": getattr(sheet, "name", ""),
                    "sheet_long_name": getattr(sheet, "lname", ""),
                    "rows": getattr(sheet, "rows", None),
                    "cols": getattr(sheet, "cols", None),
                    "column_short_names": sheet.get_labels("G"),
                    "column_long_names": sheet.get_labels("L"),
                    "column_units": sheet.get_labels("U"),
                    "column_comments": sheet.get_labels("C"),
                }
                labels_path = labels_dir / f"{stem}.labels.json"
                labels_path.write_text(json.dumps(labels, indent=2, ensure_ascii=False), encoding="utf-8")

                manifest.append(
                    {
                        "kind": "worksheet",
                        "book_index": book_idx,
                        "book_name": labels["book_name"],
                        "book_long_name": book_lname,
                        "sheet_index": sheet_idx,
                        "sheet_name": labels["sheet_name"],
                        "sheet_long_name": labels["sheet_long_name"],
                        "rows_exported": int(len(df)),
                        "cols_exported": int(len(df.columns)),
                        "csv": str(csv_path.relative_to(output_dir)),
                        "parquet": str(parquet_path.relative_to(output_dir)),
                        "labels": str(labels_path.relative_to(output_dir)),
                    }
                )

        for graph_idx, graph in enumerate(op.graph_list("p", inc_embed=True)):
            graph_name = safe_name(getattr(graph, "name", "") or f"Graph{graph_idx + 1}")
            png_path = graphs_dir / f"{graph_idx + 1:02d}_{graph_name}.png"
            graph.save_fig(str(png_path))
            manifest.append(
                {
                    "kind": "graph",
                    "graph_index": graph_idx,
                    "graph_name": getattr(graph, "name", ""),
                    "graph_long_name": getattr(graph, "lname", ""),
                    "png": str(png_path.relative_to(output_dir)),
                }
            )

        (output_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    finally:
        op.exit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export all worksheets from an OriginPro OPJU project.")
    parser.add_argument("project", type=Path, help="Path to .opju project")
    parser.add_argument("output_dir", type=Path, help="Directory for exported CSV/Parquet/metadata")
    args = parser.parse_args()
    export_project(args.project.resolve(), args.output_dir.resolve())


if __name__ == "__main__":
    main()
