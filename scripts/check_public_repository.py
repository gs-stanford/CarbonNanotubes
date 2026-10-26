"""Fail CI when private acquisition or serving artifacts enter the Git index."""
from pathlib import Path
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_ROOTS = ("data/", "web/data/", "outputs/", "reports/", "research/", "reproducibility/", "figures/")
PRIVATE_EXTENSIONS = {".xlsx", ".xls", ".sqlite", ".db", ".docx", ".pdf", ".fig", ".opju", ".m"}
PRIVATE_REPORTS = {
    "docs/PRIMARY_DATA_RELEASE_20261022.md", "docs/PRIMARY_OMISSION_CORRECTION_20261022.md",
    "docs/TRANSPORT_DATA_ADMISSION_20261025.md", "docs/V1_DATA_RELEASE.md",
}


def private_path(name):
    return (name.startswith(PRIVATE_ROOTS) or Path(name).suffix.lower() in PRIVATE_EXTENSIONS
            or name in PRIVATE_REPORTS)


def main():
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    failures = []
    shallow = subprocess.check_output(["git", "rev-parse", "--is-shallow-repository"], cwd=ROOT).strip()
    if shallow == b"true":
        failures.append("Full history required: fetch with --unshallow before validation")
    historical = subprocess.check_output(
        ["git", "log", "--all", "--format=", "--name-only", "--no-renames", "-z"], cwd=ROOT
    ).decode().split("\0")
    for name in sorted({name.strip("\n") for name in historical if name.strip("\n")}):
        if private_path(name):
            failures.append(name + ": private artifact in reachable history")
    for name in filter(None, files):
        p = ROOT / name
        if private_path(name):
            failures.append(name)
        if p.is_file() and p.suffix in {".csv", ".json", ".md", ".txt", ".tsv", ".ipynb"}:
            if re.search(r"/(?:Users|home)/[^\s\"']+", p.read_text(errors="replace")):
                failures.append(name + ": private filesystem path")
        if p.is_file() and p.suffix == ".zip":
            allowed = {"index.ts", "package.json", "package-lock.json", "manifest.json", "README.md", "LICENSE", "DATA_RIGHTS.md"}
            with zipfile.ZipFile(p) as z:
                if any(n != "cpt-mcp/" + Path(n).name or Path(n).name not in allowed for n in z.namelist()):
                    failures.append(name + ": unexpected archive payload")
    if failures:
        print("Public repository boundary failed:\n" + "\n".join(failures)); return 1
    print(f"Public repository boundary passed: {len(files)-1} tracked files and reachable history."); return 0


if __name__ == "__main__":
    sys.exit(main())
