#!/usr/bin/env node
// Separate v2 evaluation; never executes or overwrites the sealed c1e445b runner/results.
// node --experimental-strip-types benchmark/v2/run-benchmark.mjs --output <new-directory> [--source-root <snapshot>]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { questions } from "./fixtures/questions.mjs";
import { DECLINE, answerContainsGold, averageMetrics, evidenceContainsGold, factSupportsLabel, normalizeWhitespace, proportion, rankMetrics, relationsForLabelPair, strictDecline } from "./metrics.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const AUDIT = JSON.parse(await readFile(path.join(HERE, "fixtures/audit.json"), "utf8"));
const args = process.argv.slice(2);
const option = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const unknown = args.filter((_, index) => index % 2 === 0).filter((key) => !["--output", "--source-root", "--source-ref", "--compare"].includes(key));
if (unknown.length || args.length % 2 || !option("--output")) throw new Error("Use --output <new-directory> [--source-root <snapshot>] [--source-ref <provenance>] [--compare <prior-summary.json>].");
const sourceRoot = path.resolve(option("--source-root") ?? REPO);
const output = path.resolve(option("--output"));
const sourceRef = option("--source-ref") ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
if (output === sourceRoot || output.startsWith(`${path.join(REPO, "benchmark")}${path.sep}`)) throw new Error("Output must be a new directory outside benchmark source/fixtures and sealed evidence.");
if (/sealed-evidence|baseline-c1e445b/i.test(output)) throw new Error("Refusing output within a sealed-evidence or baseline-source location.");

// Resolve the repository's extensionless TypeScript imports without rewriting production files.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !path.extname(specifier)) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const load = (file) => import(pathToFileURL(path.join(sourceRoot, "src/lib", file)).href);
const [{ chunkText, inspectText }, { rankCandidates }, { baseTokens, queryTokens }, { buildAnswerPresentation }, { analyzePolicyIntelligence, extractPolicyFacts, comparePolicyFacts }] = await Promise.all([
  load("documents.ts"), load("ranking.ts"), load("text-search.ts"), load("answer-presentation.ts"), load("policy-intelligence.ts"),
]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
if (sha256(await readFile(path.join(HERE, "fixtures/questions.mjs"))) !== AUDIT.questionsSha256) throw new Error("Frozen question fixture integrity failed.");
const corpusDir = path.join(sourceRoot, "data/demo/government");
const documents = [];
const candidates = [];
const corpusHashes = {};
for (const fileName of (await readdir(corpusDir)).filter((file) => file.endsWith(".txt")).sort()) {
  const raw = await readFile(path.join(corpusDir, fileName));
  // Git on Windows may check out CRLF; the sealed Linux run used LF bytes.
  const text = raw.toString("utf8").replace(/\r\n/g, "\n");
  corpusHashes[fileName] = { rawSha256: sha256(raw), canonicalLfSha256: sha256(text) };
  if (AUDIT.corpusSha256[fileName] !== sha256(text)) throw new Error(`Frozen corpus changed: ${fileName}`);
  const document = { id: fileName, name: fileName.replace(/\.[^.]+$/, ""), originalName: fileName, mimeType: "text/plain", size: Buffer.byteLength(text), contentHash: sha256(text), status: "approved", uploadedAt: "2026-01-01T00:00:00.000Z", reviewedAt: "2026-01-02T00:00:00.000Z", documentType: "policy", inspection: inspectText(text) };
  documents.push(document);
  for (const chunk of chunkText(fileName, text)) candidates.push({ chunk, document });
}
if (documents.length !== Object.keys(AUDIT.corpusSha256).length) throw new Error("Frozen corpus document count changed.");

// This is the unchanged sealed plain-BM25 comparison algorithm; no production boosts.
function bm25Baseline(query, pool, limit = 10) {
  const qTerms = queryTokens(query);
  if (!qTerms.length || !pool.length) return [];
  const tokenized = pool.map(({ chunk, document }) => ({ chunk, document, tokens: baseTokens(chunk.text) }));
  const avgLength = tokenized.reduce((sum, item) => sum + item.tokens.length, 0) / Math.max(tokenized.length, 1);
  const docFreq = new Map();
  for (const item of tokenized) for (const token of new Set(item.tokens)) docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
  const k1 = 1.4;
  const b = 0.72;
  return tokenized.map(({ chunk, document, tokens }) => {
    const counts = new Map();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    let score = 0;
    for (const term of qTerms) {
      const tf = counts.get(term) ?? 0;
      if (!tf) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (pool.length - df + 0.5) / (df + 0.5));
      const denom = tf + k1 * (1 - b + b * (tokens.length / Math.max(avgLength, 1)));
      score += idf * ((tf * (k1 + 1)) / denom);
    }
    return { chunk, document, score };
  }).filter((hit) => hit.score > 0).sort((a, b2) => b2.score - a.score).slice(0, limit);
}

const findLabelChunks = (label) => {
  const found = candidates.filter((hit) => hit.document.id === label.docId && hit.chunk.text.includes(label.evidence));
  if (!found.length) throw new Error(`Gold evidence absent from frozen corpus: ${label.docId}`);
  return found;
};
const rawHits = (hits) => hits.map((hit, index) => ({ rank: index + 1, documentId: hit.document.id, chunkId: hit.chunk.id, chunkIndex: hit.chunk.index, chunkSha256: sha256(hit.chunk.text), score: hit.score, text: hit.chunk.text }));
const sameRanked = (left, right) => left.length === right.length && left.every((hit, index) => hit.chunk.id === right[index].chunk.id && hit.score === right[index].score);

function pairEvaluation(question, leftLabel, rightLabel, hits) {
  const result = analyzePolicyIntelligence(question.question, hits);
  const matches = relationsForLabelPair(result, leftLabel, rightLabel);
  return { matchingRelations: matches, corroborated: matches.some((relation) => ["same_rule", "likely_same_rule"].includes(relation.kind)), falseConflict: matches.some((relation) => relation.kind === "possible_conflict"), leftExtracted: result.facts.some((fact) => factSupportsLabel(fact, leftLabel)), rightExtracted: result.facts.some((fact) => factSupportsLabel(fact, rightLabel)), result };
}

const rows = [];
for (const question of questions) {
  const relevantLabels = [question, ...(question.corroborating ?? [])];
  const relevant = new Set(relevantLabels.flatMap((label) => findLabelChunks(label).map((hit) => hit.chunk.id)));
  const prod = rankCandidates(question.question, candidates, 10);
  const baseline = bm25Baseline(question.question, candidates, 10);
  const presentation = buildAnswerPresentation(question.question, prod.slice(0, 6));
  const evidence = presentation.evidence.map(({ hit, excerpt }) => ({ documentId: hit.document.id, chunkId: hit.chunk.id, excerpt, containedInSource: normalizeWhitespace(hit.chunk.text).includes(normalizeWhitespace(excerpt)) }));
  const primaryEvidenceRepresented = evidence.some((item) => evidenceContainsGold(item.excerpt, question.evidence));
  const primaryEvidenceFromExpectedDocument = evidence.some((item) => item.documentId === question.docId && evidenceContainsGold(item.excerpt, question.evidence));
  const allProductionHits = rankCandidates(question.question, candidates, candidates.length);
  const allBm25Hits = bm25Baseline(question.question, candidates, candidates.length);
  if (!sameRanked(prod, allProductionHits.slice(0, 10)) || !sameRanked(baseline, allBm25Hits.slice(0, 10))) throw new Error("Changing output limit changes the evaluated ranking prefix.");
  const intelligence = analyzePolicyIntelligence(question.question, prod.slice(0, 6));
  const clean = AUDIT.cleanCorroborationIds.includes(question.id);
  const pair = clean ? pairEvaluation(question, question, question.corroborating[0], prod.slice(0, 6)) : null;
  let control = null;
  if (question.category === "similar_not_conflict") {
    const rightLabel = { ...question.similarTo, ...(AUDIT.controlSourceCorrections[question.id] ?? {}) };
    const expectedHits = [...new Map([question, rightLabel].flatMap(findLabelChunks).map((hit) => [hit.chunk.id, { ...hit, score: 1 }])).values()];
    const directFacts = expectedHits.flatMap(extractPolicyFacts);
    const left = directFacts.filter((fact) => factSupportsLabel(fact, question));
    const right = directFacts.filter((fact) => factSupportsLabel(fact, rightLabel));
    const directRelations = left.flatMap((a) => right.filter((b) => a.id !== b.id).map((b) => comparePolicyFacts(a, b)));
    control = { ...pairEvaluation(question, question, rightLabel, prod.slice(0, 6)), directRelations, directLeftExtracted: left.length > 0, directRightExtracted: right.length > 0, anyDirectFalsePositive: directRelations.some((relation) => relation.kind !== "unrelated") };
  }
  rows.push({ id: question.id, category: question.category, question: question.question, auditDisposition: AUDIT.disputedLabels[question.id] ?? "accepted", primaryGold: { documentId: question.docId, evidence: question.evidence }, relevantChunkIds: [...relevant], deterministic: sameRanked(prod, rankCandidates(question.question, candidates, 10)), production: { metrics: rankMetrics(prod, relevant), evaluatedLimit: 10, rankedHits: rawHits(allProductionHits) }, bm25: { metrics: rankMetrics(baseline, relevant), evaluatedLimit: 10, rankedHits: rawHits(allBm25Hits) }, answerEvidence: { primaryEvidenceRepresented, primaryEvidenceFromExpectedDocument, primaryEvidenceInAnswerBody: answerContainsGold(presentation.answer, question.evidence), answer: presentation.answer, confidence: presentation.confidence, evidence, support: presentation.support ?? null, facets: presentation.facets ?? null }, policyIntelligence: { factCoverage: intelligence.facts.length > 0, facts: intelligence.facts, relations: intelligence.relations, cleanPair: pair, control } });
}

const unsupported = AUDIT.unsupportedQuestions.map((question) => {
  const hits = rankCandidates(question, candidates, 10);
  const presentation = buildAnswerPresentation(question, hits.slice(0, 6));
  return { question, production: rawHits(rankCandidates(question, candidates, candidates.length)), strictDecline: strictDecline(presentation), emptyEvidence: presentation.evidence.length === 0, confidence: presentation.confidence, answer: presentation.answer, evidence: presentation.evidence.map(({ hit, excerpt }) => ({ documentId: hit.document.id, chunkId: hit.chunk.id, excerpt })) };
});
const scoreAnswers = (items) => ({ primaryEvidenceRepresented: proportion(items, (row) => row.answerEvidence.primaryEvidenceRepresented), primaryEvidenceFromExpectedDocument: proportion(items, (row) => row.answerEvidence.primaryEvidenceFromExpectedDocument), primaryEvidenceInAnswerBody: proportion(items, (row) => row.answerEvidence.primaryEvidenceInAnswerBody), highConfidenceMissingPrimaryEvidence: items.filter((row) => row.answerEvidence.confidence === "high" && !row.answerEvidence.primaryEvidenceRepresented).map((row) => row.id), missedPrimaryEvidence: items.filter((row) => !row.answerEvidence.primaryEvidenceRepresented).map((row) => row.id) });
const accepted = rows.filter((row) => row.auditDisposition === "accepted");
const cleanRows = rows.filter((row) => row.policyIntelligence.cleanPair);
const controlRows = rows.filter((row) => row.policyIntelligence.control);
const answerScores = scoreAnswers(rows);
const generalScores = scoreAnswers(rows.filter((row) => row.category === "general"));
const cleanScore = proportion(cleanRows, (row) => row.policyIntelligence.cleanPair.corroborated);
const controlFailures = controlRows.filter((row) => row.policyIntelligence.control.corroborated || row.policyIntelligence.control.falseConflict || row.policyIntelligence.control.anyDirectFalsePositive || row.policyIntelligence.relations.some((relation) => relation.kind === "possible_conflict")).map((row) => row.id);
const sourceFiles = {};
for (const name of (await readdir(path.join(sourceRoot, "src/lib"))).filter((name) => name.endsWith(".ts")).sort()) sourceFiles[`src/lib/${name}`] = sha256((await readFile(path.join(sourceRoot, "src/lib", name), "utf8")).replace(/\r\n/g, "\n"));
const codeHashes = {};
for (const file of ["run-benchmark.mjs", "metrics.mjs", "fixtures/audit.json", "fixtures/questions.mjs"]) codeHashes[file] = sha256(await readFile(path.join(HERE, file)));
const summary = {
  version: 2, createdAt: new Date().toISOString(), provenance: { sealedCommit: AUDIT.sealedCommit, sealedZipSha256: AUDIT.sealedZipSha256, independentAuditCommit: AUDIT.independentAuditCommit, sourceRef, sourceRoot, node: process.version, platform: process.platform, sourceFiles, evaluationFiles: codeHashes, corpusHashes },
  conditions: { corpus: "Frozen eight-document synthetic corpus; LF canonicalisation only", documentCount: documents.length, chunkCount: candidates.length, evaluatedRetrievalLimit: 10, answerAndPolicyHitLimit: 6, rawHits: "Every positive ranked hit, with verified top-10 prefix equivalence; chunk IDs are per-run UUIDs and chunk hashes support comparison", scope: "In-process production chunking/ranking/answer/policy functions; no HTTP/auth/storage/deployed latency claim", answerEvidenceProxy: "Whitespace-normalized primary-gold/excerpt containment in either direction; same proxy as independent audit, not full semantic correctness", answerBodyProxy: "Entire labelled primary evidence appears in answer text after case and whitespace normalization; reported separately", disputedLabels: "Original 85-row comparison retained; eight audit exceptions excluded only in the separately named adjudicated subset; only five clean corroboration relations are scored", policyFactCoverage: "At least one extracted fact is coverage only, not extraction accuracy", heldOut: "No independent held-out questions; audited corpus questions are fixed comparison/development data" },
  retrieval: { production: averageMetrics(rows, "production"), bm25: averageMetrics(rows, "bm25"), byCategory: Object.fromEntries([...new Set(rows.map((row) => row.category))].map((category) => [category, { total: rows.filter((row) => row.category === category).length, production: averageMetrics(rows.filter((row) => row.category === category), "production"), bm25: averageMetrics(rows.filter((row) => row.category === category), "bm25") }])), allDeterministic: rows.every((row) => row.deterministic) },
  answerEvidence: { historicalAll85: answerScores, general40: generalScores, adjudicated77: scoreAnswers(accepted), byCategory: Object.fromEntries([...new Set(rows.map((row) => row.category))].map((category) => [category, scoreAnswers(rows.filter((row) => row.category === category))])) },
  unsupported: { strictDecline: proportion(unsupported, (row) => row.strictDecline), highConfidence: unsupported.filter((row) => row.confidence === "high").length, requiredResponse: DECLINE },
  policyIntelligence: { cleanCorroboration: cleanScore, cleanIds: AUDIT.cleanCorroborationIds, cleanMisses: cleanRows.filter((row) => !row.policyIntelligence.cleanPair.corroborated).map((row) => row.id), similarNotConflictControls: { total: controlRows.length, falsePositiveIds: controlFailures, directPairExtractionCovered: proportion(controlRows, (row) => row.policyIntelligence.control.directLeftExtracted && row.policyIntelligence.control.directRightExtracted) }, factCoverage: proportion(rows.filter((row) => ["obligation", "corroboration"].includes(row.category)), (row) => row.policyIntelligence.factCoverage), possibleConflictsAllRows: rows.reduce((sum, row) => sum + row.policyIntelligence.relations.filter((relation) => relation.kind === "possible_conflict").length, 0) },
  auditCorrections: { disputedLabels: AUDIT.disputedLabels, controlSourceCorrections: AUDIT.controlSourceCorrections, rankingStatements: ["Q034", "Q081"].map((id) => { const row = rows.find((item) => item.id === id); return { id, productionFirstGoldRank: row.production.rankedHits.find((hit) => row.relevantChunkIds.includes(hit.chunkId))?.rank ?? null, bm25FirstGoldRank: row.bm25.rankedHits.find((hit) => row.relevantChunkIds.includes(hit.chunkId))?.rank ?? null }; }), corroborationTop5: rows.filter((row) => row.category === "corroboration").map((row) => ({ id: row.id, allLabelledDocumentsInTop5: [questions.find((question) => question.id === row.id).docId, ...questions.find((question) => question.id === row.id).corroborating.map((label) => label.docId)].every((id) => row.production.rankedHits.slice(0, 5).some((hit) => hit.documentId === id)) })) },
  gates: { retrievalHitAt3: averageMetrics(rows, "production").hitAt3 >= 0.95, answerEvidenceAt90: answerScores.primaryEvidenceRepresented.rate >= 0.90, generalAnswerEvidenceAt85: generalScores.primaryEvidenceRepresented.rate >= 0.85, unsupportedDeclineAt90: proportion(unsupported, (row) => row.strictDecline).rate >= 0.90, cleanCorroborationAt80: cleanScore.rate >= 0.80, similarNotConflictNoFalsePositives: controlRows.length === 10 && controlFailures.length === 0 },
};
if (option("--compare")) {
  const prior = JSON.parse(await readFile(path.resolve(option("--compare")), "utf8"));
  summary.comparison = { baseline: path.resolve(option("--compare")), sameEvaluationFiles: JSON.stringify(prior.provenance.evaluationFiles) === JSON.stringify(summary.provenance.evaluationFiles), sameCorpus: Object.keys(AUDIT.corpusSha256).every((file) => prior.provenance.corpusHashes[file]?.canonicalLfSha256 === corpusHashes[file].canonicalLfSha256), retrievalHitAt3Delta: summary.retrieval.production.hitAt3 - prior.retrieval.production.hitAt3, answerPrimaryEvidenceDelta: answerScores.primaryEvidenceRepresented.rate - prior.answerEvidence.historicalAll85.primaryEvidenceRepresented.rate, answerBodyEvidenceDelta: answerScores.primaryEvidenceInAnswerBody.rate - prior.answerEvidence.historicalAll85.primaryEvidenceInAnswerBody.rate, strictDeclineDelta: summary.unsupported.strictDecline.rate - prior.unsupported.strictDecline.rate, cleanCorroborationDelta: cleanScore.rate - prior.policyIntelligence.cleanCorroboration.rate };
  if (!summary.comparison.sameEvaluationFiles || !summary.comparison.sameCorpus) throw new Error("Baseline and current evaluation/corpus differ; a fair comparison requires identical evaluator bytes.");
}
await mkdir(output); // Refuse an existing path rather than overwrite any run.
await writeFile(path.join(output, "per-question.json"), JSON.stringify({ rows, unsupported }, null, 2) + "\n", { flag: "wx" });
await writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, retrieval: summary.retrieval.production, answerEvidence: answerScores.primaryEvidenceRepresented, generalEvidence: generalScores.primaryEvidenceRepresented, answerBodyEvidence: answerScores.primaryEvidenceInAnswerBody, unsupported: summary.unsupported, policyIntelligence: summary.policyIntelligence, gates: summary.gates, comparison: summary.comparison ?? null }, null, 2));
