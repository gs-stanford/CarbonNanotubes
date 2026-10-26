"""Fail CI when private acquisition or serving artifacts enter the Git index."""
from pathlib import Path
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_ROOTS = ("data/", "web/data/", "outputs/", "reports/", "research/", "reproducibility/", "figures/")
PRIVATE_EXTENSIONS = {".xlsx", ".xls", ".sqlite", ".db", ".docx", ".pdf", ".fig", ".opju", ".m"}


def main():
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    failures = []
    for name in filter(None, files):
        p = ROOT / name
        if name.startswith(PRIVATE_ROOTS) or p.suffix.lower() in PRIVATE_EXTENSIONS:
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
    print(f"Public repository boundary passed: {len(files)-1} tracked files."); return 0


if __name__ == "__main__":
    sys.exit(main())
