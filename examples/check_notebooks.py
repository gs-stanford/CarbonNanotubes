"""Validate and optionally execute the public CPT example notebooks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


EXAMPLE_DIR = Path(__file__).resolve().parent
NOTEBOOKS = (
    EXAMPLE_DIR / "01_quickstart.ipynb",
    EXAMPLE_DIR / "02_candidate_benchmark.ipynb",
)


def load_notebook(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("nbformat") != 4 or not isinstance(payload.get("cells"), list):
        raise RuntimeError(f"{path.name} is not a valid version 4 notebook.")
    return payload


def source_text(cell: dict[str, Any]) -> str:
    source = cell.get("source", "")
    return "".join(source) if isinstance(source, list) else str(source)


def check_notebook(path: Path) -> None:
    payload = load_notebook(path)
    code_cells = [cell for cell in payload["cells"] if cell.get("cell_type") == "code"]
    if not code_cells:
        raise RuntimeError(f"{path.name} contains no code cells.")
    combined_source = "\n".join(source_text(cell) for cell in code_cells)
    if "import carbon_property_tables as cpt" not in combined_source:
        raise RuntimeError(f"{path.name} does not use the public cpt import pattern.")
    for index, cell in enumerate(code_cells, start=1):
        compile(source_text(cell), f"{path.name}:cell-{index}", "exec")


def execute_notebook(path: Path, output_dir: Path, timeout: int) -> Path:
    try:
        import nbformat
        from nbclient import NotebookClient
    except ImportError as error:
        raise RuntimeError(
            "Notebook execution requires nbclient, nbformat, and ipykernel."
        ) from error

    run_dir = output_dir / path.stem
    run_dir.mkdir(parents=True, exist_ok=True)
    notebook = nbformat.read(path, as_version=4)
    client = NotebookClient(
        notebook,
        timeout=timeout,
        kernel_name="python3",
        resources={"metadata": {"path": str(run_dir)}},
    )
    client.execute()
    executed_path = run_dir / path.name
    nbformat.write(notebook, executed_path)
    return executed_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Execute every cell against the live CPT API.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("/tmp/cpt-notebook-examples"),
        help="Destination for executed notebooks and generated artifacts.",
    )
    parser.add_argument("--timeout", type=int, default=180, help="Per-cell execution timeout in seconds.")
    args = parser.parse_args()

    for notebook_path in NOTEBOOKS:
        check_notebook(notebook_path)
        print(f"checked {notebook_path.name}")
        if args.execute:
            executed = execute_notebook(notebook_path, args.output_dir.resolve(), args.timeout)
            print(f"executed {executed}")


if __name__ == "__main__":
    main()
