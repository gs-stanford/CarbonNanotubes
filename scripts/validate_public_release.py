#!/usr/bin/env python3
"""Rebuild and validate the CNT Property Atlas public release.

This is the pre-launch gate. It starts from the raw workbook-derived inputs,
regenerates processed and public artifacts, syncs the web payload, runs the
strict data-integrity audit, then verifies the frontend can typecheck/build.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


def run(label: str, command: list[str], cwd: Path = ROOT) -> None:
    print(f"\n==> {label}", flush=True)
    print(" ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-web-build",
        action="store_true",
        help="Run data validation but skip TypeScript and Next.js production build.",
    )
    args = parser.parse_args()

    npm = shutil.which("npm")
    if npm is None:
        print("npm was not found on PATH; cannot validate the web app.", file=sys.stderr)
        return 2

    python = sys.executable
    steps: list[tuple[str, list[str], Path]] = [
        ("Build combined source database", [python, "scripts/build_combined_database.py"], ROOT),
        ("Validate publications from DOI cache", [python, "scripts/validate_publications.py", "--offline"], ROOT),
        ("Build curation dataset", [python, "scripts/build_curation_dataset.py"], ROOT),
        ("Build public release", [python, "scripts/build_public_release.py"], ROOT),
        ("Sync website public data", [npm, "run", "sync:data"], WEB),
        ("Audit public data integrity", [python, "scripts/audit_public_data_integrity.py"], ROOT),
    ]

    if not args.skip_web_build:
        steps.extend(
            [
                ("Typecheck web app", [npm, "run", "typecheck"], WEB),
                ("Build web app", [npm, "run", "build"], WEB),
            ]
        )

    for label, command, cwd in steps:
        run(label, command, cwd)

    print("\nPublic release validation passed.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
