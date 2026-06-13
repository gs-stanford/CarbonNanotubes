import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const source = path.join(root, "data", "public");
const target = path.join(root, "web", "data", "public");

await fs.mkdir(target, { recursive: true });

for (const file of await fs.readdir(source)) {
  if (!file.endsWith(".csv") && !file.endsWith(".json")) continue;
  await fs.copyFile(path.join(source, file), path.join(target, file));
}

console.log(JSON.stringify({ copiedFrom: source, copiedTo: target }, null, 2));
