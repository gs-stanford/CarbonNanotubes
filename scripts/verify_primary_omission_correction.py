#!/usr/bin/env python3
"""Verify the correction is additive relative to the deployed October 22 release."""
import argparse
import io
import json
import subprocess
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs/primary_omission_correction_20261022"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-revision", default="71e5eebe7b8f06aea638ac0021910d211819acf3")
    args = parser.parse_args()
    old = {}
    for kind in ("records", "measurements", "publications"):
        name = f"public_{kind}_v0.csv"
        local = OUT / "baseline" / name
        source = local if local.exists() else io.StringIO(subprocess.check_output(
            ["git", "show", f"{args.baseline_revision}:data/public/{name}"], cwd=ROOT, text=True))
        old[kind] = pd.read_csv(source, keep_default_na=False)
    new = {kind: pd.read_csv(ROOT / "data/public" / f"public_{kind}_v0.csv", keep_default_na=False)
           for kind in old}
    errors = []
    if not set(old["records"].record_id).issubset(new["records"].record_id):
        errors.append("Previously deployed record lost")
    previous = old["measurements"].set_index("measurement_id")
    current = new["measurements"].set_index("measurement_id")
    if not current.index.is_unique:
        errors.append("Duplicate measurement ID")
    for mid, before in previous.iterrows():
        if mid not in current.index:
            errors.append(f"Previously deployed measurement lost: {mid}")
            continue
        after = current.loc[mid]
        for field in ("record_id", "property", "unit_canonical", "reported_or_derived"):
            if before[field] != after[field]:
                errors.append(f"Previously deployed metadata changed: {mid}/{field}")
        if abs(float(before.value_canonical) - float(after.value_canonical)) > max(abs(float(before.value_canonical))*1e-12, 1e-30):
            errors.append(f"Previously deployed value changed: {mid}")
    by_paper = []
    for path in sorted((ROOT / "data/curation/primary_additions").glob("*.json")):
        payload = json.loads(path.read_text())
        ids = {r["record_id"] for r in payload["records"]}
        subset = new["measurements"][new["measurements"].record_id.isin(ids)]
        before = old["measurements"][old["measurements"].record_id.isin(ids)]
        by_paper.append(dict(packet=path.name, records=len(ids), measurements=len(subset),
                            added_measurements=len(subset)-len(before),
                            properties=subset.property.value_counts().to_dict()))
        for r in payload["records"]:
            for prop, meta in r["measurement_metadata"].items():
                rows = subset[(subset.record_id == r["record_id"]) & (subset.property == prop)]
                if len(rows) != 1:
                    errors.append(f"Packet value missing or duplicated: {r['record_id']}/{prop}")
                    continue
                for field in ("source_locator", "source_qualification", "density_basis", "normalization_basis"):
                    if meta.get(field) and rows.iloc[0].get(field) != meta[field]:
                        errors.append(f"Qualification lost: {r['record_id']}/{prop}/{field}")
    for kind in new:
        filename = f"public_{kind}_v0.csv"
        if (ROOT / "data/public" / filename).read_bytes() != (ROOT / "web/data/public" / filename).read_bytes():
            errors.append(f"Root/web payload differs: {kind}")
    report = dict(status="fail" if errors else "pass", errors=errors,
                  before={k: len(v) for k,v in old.items()}, after={k: len(v) for k,v in new.items()},
                  papers=by_paper, deployment_verified=False)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "verification.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
