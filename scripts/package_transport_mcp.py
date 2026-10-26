#!/usr/bin/env python3
"""Package the public-service MCP adapter without any private source material."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "integrations/cpt-mcp"


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    source = DEST / "index.ts"
    package = {"name": "cpt-processing-mcp", "version": "0.1.0", "private": True, "type": "module", "license": "MIT",
               "engines": {"node": ">=22"}, "scripts": {"start": "node --import tsx index.ts"},
               "dependencies": {"@modelcontextprotocol/sdk": "1.32.1", "zod": "4.6.7", "tsx": "4.23.13"}}
    (DEST / "package.json").write_text(json.dumps(package, indent=2) + "\n")
    contract = {"adapter_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "paper2agent_reference_revision": "8c2d059165ef8cdcb70dbea76655b9c2b55b38e6",
                "relationship": "CPT implementation using Paper2Agent's resource/tool verification principles, not a claim to execute its complete generation pipeline.",
                "network": "Only calls configured CPT_API_URL; default public CPT HTTPS API.",
                "private_documents_in_package": False, "model_training": False}
    (DEST / "manifest.json").write_text(json.dumps(contract, indent=2) + "\n")
    readme = (ROOT / "docs/PROCESSING_TOOLS.md").read_text().replace("](API_TUTORIAL.md)", "](https://github.com/gs-stanford/CarbonNanotubes/blob/main/docs/API_TUTORIAL.md)")
    (DEST / "README.md").write_text(readme)
    shutil.copy2(ROOT / "LICENSE", DEST / "LICENSE")
    shutil.copy2(ROOT / "DATA_RIGHTS.md", DEST / "DATA_RIGHTS.md")
    if (DEST / "package-lock.json").exists():
        contract["dependency_lock_sha256"] = hashlib.sha256((DEST / "package-lock.json").read_bytes()).hexdigest()
        (DEST / "manifest.json").write_text(json.dumps(contract, indent=2) + "\n")
        target = ROOT / "web/public/downloads/cpt-processing-mcp-0.1.0.zip"
        target.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name in ["index.ts", "package.json", "package-lock.json", "manifest.json", "README.md", "LICENSE", "DATA_RIGHTS.md"]:
                archive.write(DEST / name, "cpt-mcp/" + name)
    print(json.dumps(contract))


if __name__ == "__main__":
    main()
