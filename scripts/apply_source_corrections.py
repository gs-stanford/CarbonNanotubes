"""Apply source-audited release corrections without modifying inherited workbooks."""

import json
from pathlib import Path

import numpy as np
import pandas as pd

CORRECTIONS = Path(__file__).resolve().parents[1] / "data/curation/source_corrections.json"
FIELDS = {
    "electrical_conductivity": "electrical_conductivity_S_m",
    "specific_electrical_conductivity": "specific_electrical_conductivity_S_m2_kg",
    "thermal_conductivity": "thermal_conductivity_W_mK",
    "specific_thermal_conductivity": "specific_thermal_conductivity_W_m2_K_kg",
}
CHILDREN = {"electrical_conductivity": "specific_electrical_conductivity",
            "thermal_conductivity": "specific_thermal_conductivity"}


def apply_source_corrections(records, measurements, path=CORRECTIONS):
    records, measurements = records.copy(), measurements.copy()
    audit = []
    for entry in json.loads(path.read_text())["corrections"]:
        rid = entry["record_id"]
        mask = records.record_id.eq(rid)
        if mask.sum() != 1:
            raise ValueError(f"Correction must match exactly one record: {rid}")
        row = records.loc[mask].iloc[0]
        if entry["doi"].lower() not in str(row.get("doi_raw", "")).lower():
            raise ValueError(f"Source identity changed: {rid}")
        changes = []
        for field, value in entry.get("fields", {}).items():
            changes.append({"field": field, "before": str(row.get(field)), "after": value})
            records.loc[mask, field] = value if value is not None else np.nan
            if field in measurements.columns:
                measurements.loc[measurements.record_id.eq(rid), field] = value if value is not None else np.nan
        for prop, operation in entry.get("properties", {}).items():
            col = FIELDS[prop]
            expected = operation["expected"]
            if not np.isclose(float(row[col]), expected, rtol=1e-9):
                raise ValueError(f"Source value changed; review correction: {rid}/{prop}")
            pm = measurements.record_id.eq(rid) & measurements.property.eq(prop)
            if pm.sum() != 1 or not np.isclose(float(measurements.loc[pm, "value_canonical"].iloc[0]), expected):
                raise ValueError(f"Measurement mismatch: {rid}/{prop}")
            action = operation["action"]
            affected = [prop] + ([CHILDREN[prop]] if prop in CHILDREN else [])
            if action == "remove_unlinked":
                for p in affected:
                    records.loc[mask, FIELDS[p]] = np.nan
                measurements = measurements[~(measurements.record_id.eq(rid) & measurements.property.isin(affected))].copy()
            elif action == "source_estimate":
                mm = measurements.record_id.eq(rid) & measurements.property.isin(affected)
                measurements.loc[mm, "reported_or_derived"] = "source_estimate"
                measurements.loc[mm, "source_qualification"] = operation["reason"]
            elif action == "replace":
                value = operation["value"]
                records.loc[mask, col] = value
                measurements.loc[pm, "value_canonical"] = value
                measurements.loc[pm, "reported_value"] = value
                measurements.loc[pm, "reported_or_derived"] = "reported"
                measurements.loc[pm, "source_locator"] = entry["locator"]
                measurements.loc[pm, "source_qualification"] = operation["reason"]
                child = CHILDREN.get(prop)
                cm = measurements.record_id.eq(rid) & measurements.property.eq(child)
                if cm.any():
                    # Only scale an explicitly density-derived child, never a separate reported value.
                    if not measurements.loc[cm, "reported_or_derived"].eq("derived").all():
                        raise ValueError(f"Review independent normalized value: {rid}/{child}")
                    new = value / float(row.density_kg_m3)
                    records.loc[mask, FIELDS[child]] = new
                    measurements.loc[cm, "value_canonical"] = new
                    measurements.loc[cm, "source_qualification"] = operation["reason"]
                    for idx in measurements.index[cm]:
                        inputs = json.loads(measurements.at[idx, "derivation_inputs_json"])
                        inputs[col] = value
                        measurements.at[idx, "derivation_inputs_json"] = json.dumps(inputs)
                        measurements.at[idx, "source_locator"] = entry["locator"]
            else:
                raise ValueError(f"Unknown correction action: {action}")
            changes.append({"property": prop, **operation})
        audit.append({**entry, "applied_changes": changes})
    return records, measurements, audit
