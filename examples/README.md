# Carbon Property Tables notebooks

These notebooks use the public, bounded Carbon Property Tables Python API. They request server-rendered figures and citation sidecars; they do not download the canonical database.

## Install

```bash
python -m pip install carbon-property-tables==0.3.3 jupyterlab
jupyter lab examples/
```

## Notebooks

- `01_quickstart.ipynb`: readable property names, scatter rendering, SVG export, and a citation-backed top-five table.
- `02_candidate_benchmark.ipynb`: compare a temporary user result against the visible peer-reviewed CNT landscape without writing it to the database.

## Validate both notebooks

```bash
python -m pip install nbclient nbformat ipykernel
python examples/check_notebooks.py \
  --execute \
  --output-dir /tmp/cpt-notebook-examples
```

Without `--execute`, the checker uses only the Python standard library to validate notebook structure and compile every code cell. With `--execute`, it runs every cell against the live API and writes executed notebooks plus generated figures to the selected output directory.
