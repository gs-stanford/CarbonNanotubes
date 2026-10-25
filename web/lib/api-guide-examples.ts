// Executed by scripts/test-api-guide.py against the published Python package.
export const API_GUIDE_EXAMPLES = {
  install: `python -m pip install carbon-property-tables==0.4.0`,
  quickstart: `import carbon_property_tables as cpt

release_id = cpt.release()["release"]["release_id"]

figure = cpt.scatter(
    "specific strength",        # x: N/tex
    "specific cond",            # y: kS m^2/kg
    log_x=True,
    log_y=True,
    release=release_id,
    formats=("svg", "png", "pdf"),
    top=5,
    top_by="y",
)

figure.save_bundle("conductivity-vs-strength")
print(figure.top_table())
# In a notebook, display the figure with: figure`,
  modes: `import carbon_property_tables as cpt

x, y = "specific strength", "specific cond"
options = dict(
    release=cpt.release()["release"]["release_id"],
    log_x=True, log_y=True,
    formats=("svg", "png", "pdf"),
)

for mode in ("scatter", "ranked", "trend", "ashby"):
    figure = getattr(cpt, mode)(x, y, **options)
    figure.save_bundle(mode)`,
  filters: `import carbon_property_tables as cpt

figure = cpt.scatter(
    "specific strength", "specific cond",
    log_x=True, log_y=True,
    release=cpt.release()["release"]["release_id"],
    material_family=[
        "CNT_or_CNT_hybrid",
        "carbon_fiber_comparator",
    ],
    form_factor="fiber_yarn",
    measurement_filter=["density:500:2000"],
    top=5, top_by="y",
)
figure.save_bundle("filtered-fibers")
figure.save_top_table("top-five.csv")`,
  temporary: `import carbon_property_tables as cpt
from carbon_property_tables import TemporaryPoint

figure = cpt.scatter(
    "specific strength", "specific cond",
    log_x=True, log_y=True,
    release=cpt.release()["release"]["release_id"],
    form_factor="fiber_yarn",
    temporary=TemporaryPoint(
        x=1.8,                  # N/tex
        y=12.0,                 # kS m^2/kg
        label="My sample",
    ),
    formats=("svg", "png", "pdf"),
)
figure.save_bundle("my-sample")
print(figure.temporary_point)`,
  search: `import carbon_property_tables as cpt

print(cpt.has_doi("10.1126/science.adj1082"))

for paper in cpt.search("carbon nanotube", limit=5):
    print(paper.title, paper.doi)

for prop in cpt.properties():
    print(prop["key"], prop["display_unit"])`,
  rest: `curl --fail-with-body \\
  https://carbonnanotubes.onrender.com/api/v1/figures \\
  -H 'Content-Type: application/json' \\
  -d '{
    "kind": "scatter",
    "x": "specific_strength",
    "y": "specific_electrical_conductivity",
    "x_scale": "log",
    "y_scale": "log",
    "minimum_x": 2.0,
    "show_callouts": false,
    "formats": ["svg", "png", "pdf"],
    "top": 5,
    "top_by": "y",
    "filters": {"form_factor": "fiber_yarn"}
  }' > figure-response.json`,
  restSave: `import base64
import json
from pathlib import Path

result = json.loads(Path("figure-response.json").read_text())
Path("comparison.svg").write_text(result["images"]["svg"])
for fmt in ("png", "pdf"):
    Path(f"comparison.{fmt}").write_bytes(
        base64.b64decode(result["images"][f"{fmt}_base64"])
    )
Path("comparison.bib").write_text(result["citations"]["bibtex"])
Path("comparison.citations.txt").write_text(
    result["citations"]["copy_all"]
)
# Keep this response and the original request for reproducibility.`,
} as const;
