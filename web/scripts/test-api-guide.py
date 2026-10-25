"""Execute the website's exact Python examples, preferably with the PyPI wheel.

CPT_TEST_URL=http://localhost:3002 PYTHONPATH=/path/to/installed/wheel \
    python scripts/test-api-guide.py
"""

import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import time

import carbon_property_tables as cpt

web = Path(__file__).resolve().parents[1]
examples = json.loads(subprocess.check_output([
    "node", "--input-type=module", "-e",
    "import { API_GUIDE_EXAMPLES } from './lib/api-guide-examples.ts'; "
    "console.log(JSON.stringify(API_GUIDE_EXAMPLES));",
], cwd=web, text=True))
base = os.environ.get("CPT_TEST_URL", "http://localhost:3002").rstrip("/")
output = Path(os.environ.get("CPT_QA_DIR", "/tmp/cpt-api-guide-qa")).resolve()
output.mkdir(parents=True, exist_ok=True)
os.chdir(output)
cpt.configure(base, timeout=120)
results = []

for name in ("quickstart", "modes", "filters", "temporary", "search"):
    start = time.monotonic()
    scope = {"__name__": "__main__"}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(examples[name], f"api-guide:{name}", "exec"), scope)
    if name == "quickstart":
        assert len(scope["figure"].top_table()) == 5
        for extension, signature in (("svg", b"<svg"), ("png", b"\x89PNG"), ("pdf", b"%PDF")):
            data = Path(f"conductivity-vs-strength.{extension}").read_bytes()
            assert signature in data[:1000], extension
        assert Path("conductivity-vs-strength.bib").stat().st_size > 0
    elif name == "modes":
        for mode in ("scatter", "ranked", "trend", "ashby"):
            assert Path(f"{mode}.svg").stat().st_size > 0
    elif name == "filters":
        rows = scope["figure"].top_table()
        assert rows and all(row["form_factor"] == "Fiber / yarn" for row in rows)
        assert all(row["material_family"] in ("CNT", "Carbon fiber") for row in rows)
    elif name == "temporary":
        rank = scope["figure"].temporary_point
        assert rank is not None and rank.x_rank >= 1 and rank.y_rank >= 1
        assert "My sample" in Path("my-sample.svg").read_text()
    results.append({"example": name, "passed": True, "seconds": round(time.monotonic() - start, 2)})

command = examples["rest"].replace("https://carbonnanotubes.onrender.com", base)
subprocess.run(["sh", "-c", command], check=True, capture_output=True)
exec(compile(examples["restSave"], "api-guide:restSave", "exec"))
response = json.loads(Path("figure-response.json").read_text())
assert response["requirement"]["minimum_x"] == 2
assert all(row["x_value"] >= 2 for row in response["top_points"])
assert "requirement-cutoff" in response["images"]["svg"]
assert 'class="point-label"' not in response["images"]["svg"]
assert Path("comparison.png").read_bytes().startswith(b"\x89PNG")
assert Path("comparison.pdf").read_bytes().startswith(b"%PDF")
results.append({"example": "REST request and export", "passed": True})
receipt = {
    "base_url": base,
    "sdk_version": cpt.__version__,
    "sdk_path": cpt.__file__,
    "release": cpt.release()["release"],
    "results": results,
}
Path("api-guide-verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, indent=2))
