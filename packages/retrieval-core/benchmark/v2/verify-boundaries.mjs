// Read-only provenance and production/evaluation dependency boundary checks.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const audit = JSON.parse(await readFile(path.join(root, "benchmark/v2/fixtures/audit.json"), "utf8"));
const freeze = JSON.parse(execFileSync(process.execPath, ["scripts/verify-retrieval-freeze.mjs"], { cwd: root, encoding: "utf8" }));

// The existing byte manifest covers ranking, candidate retrieval, tokenization,
// and all corpus files. Also compare chunking/index-storage code with the exact
// sealed Git commit; only Windows checkout line endings are normalized here.
const canonicalLf = (value) => value.toString("utf8").replace(/\r\n/g, "\n");
const frozenCode = ["src/lib/ranking.ts", "src/lib/retrieval.ts", "src/lib/text-search.ts", "src/lib/documents.ts", "src/lib/store.ts"];
for (const file of frozenCode) {
  const original = execFileSync("git", ["show", `${audit.sealedCommit}:${file}`], { cwd: root });
  assert.equal(canonicalLf(await readFile(path.join(root, file))), canonicalLf(original), `Frozen production source changed: ${file}`);
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

const files = await sourceFiles(path.join(root, "src"));
const references = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  // Inspect literal import paths and file paths as AST nodes, so comments do
  // not trip the gate. Evaluation may import production; the reverse is barred.
  const visit = (node) => {
    if (ts.isStringLiteralLike(node) && /(?:^|[/\\])benchmark(?:[/\\]|$)/i.test(node.text)) {
      references.push({ file: path.relative(root, file), line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, reference: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
assert.deepEqual(references, [], "Production references evaluation artifacts");
console.log(JSON.stringify({ sealedCommit: audit.sealedCommit, byteFreeze: freeze, additionalFrozenCodeChecked: frozenCode, productionFilesInspected: files.length, productionEvaluationReferences: references, limitations: "Static string-literal boundary check; independent review still checks behaviour and computed references." }, null, 2));
