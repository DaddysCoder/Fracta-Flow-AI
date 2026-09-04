import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../tests/fixtures/retrieval-freeze.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const changed = [];

for (const [file, expected] of Object.entries(manifest)) {
  const contents = await readFile(new URL(`../${file}`, import.meta.url));
  const actual = createHash("sha256").update(contents).digest("hex");
  if (actual !== expected) changed.push({ file, expected, actual });
}

if (changed.length) {
  console.error(JSON.stringify({ frozenFiles: Object.keys(manifest).length, changed }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ frozenFiles: Object.keys(manifest).length, changed: 0 }, null, 2));
}
