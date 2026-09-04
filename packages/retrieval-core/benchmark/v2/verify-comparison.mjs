import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A no-false-positive result must not be achieved by dropping previously
// extracted control evidence. Some controls have no modal fact to extract.
export function checkControlPreservation(baselineRows, currentRows) {
  const current = new Map(currentRows.map((row) => [row.id, row]));
  const regressions = [];
  for (const prior of baselineRows.filter((row) => row.policyIntelligence.control)) {
    const next = current.get(prior.id)?.policyIntelligence.control;
    if (!next) { regressions.push({ id: prior.id, field: "controlMissing" }); continue; }
    for (const field of ["directLeftExtracted", "directRightExtracted"]) {
      if (prior.policyIntelligence.control[field] && !next[field]) regressions.push({ id: prior.id, field });
    }
  }
  return { checked: baselineRows.filter((row) => row.policyIntelligence.control).length, preserved: regressions.length === 0, regressions };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [baselinePath, currentPath, gateFlag] = process.argv.slice(2);
  if (!baselinePath || !currentPath || (gateFlag && gateFlag !== "--require-gates")) throw new Error("Use verify-comparison.mjs <baseline-directory> <current-directory> [--require-gates].");
  const read = (directory, file) => readFile(path.join(directory, file), "utf8").then(JSON.parse);
  const [baseline, current, baselineRaw, currentRaw] = await Promise.all([read(baselinePath, "summary.json"), read(currentPath, "summary.json"), read(baselinePath, "per-question.json"), read(currentPath, "per-question.json")]);
  assert.deepEqual(current.provenance.evaluationFiles, baseline.provenance.evaluationFiles, "Evaluator bytes changed");
  assert.deepEqual(Object.fromEntries(Object.entries(current.provenance.corpusHashes).map(([file, hashes]) => [file, hashes.canonicalLfSha256])), Object.fromEntries(Object.entries(baseline.provenance.corpusHashes).map(([file, hashes]) => [file, hashes.canonicalLfSha256])), "Corpus changed");
  const controls = checkControlPreservation(baselineRaw.rows, currentRaw.rows);
  assert.equal(controls.checked, 10, "All ten controls must be represented");
  assert.equal(controls.preserved, true, JSON.stringify(controls.regressions));
  assert.equal(current.policyIntelligence.similarNotConflictControls.falsePositiveIds.length, 0, "False positive control relation");
  const failedGates = Object.entries(current.gates).filter(([, passed]) => !passed).map(([gate]) => gate);
  console.log(JSON.stringify({ sameEvaluator: true, sameCorpus: true, controls, failedGates, developmentScope: "Fixed audited evaluation questions were not supplied to answer implementation; only the five independently accepted corroboration pairs were used as the authorised development subset." }, null, 2));
  if (gateFlag) assert.deepEqual(failedGates, [], "Release gates not met");
}
