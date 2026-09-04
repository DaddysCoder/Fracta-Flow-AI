// Evaluation only. These functions must never be imported by production code.
export const DECLINE = "I couldn't find enough support for that in the approved documents.";

export function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function evidenceContainsGold(excerpt, gold) {
  const actual = normalizeWhitespace(excerpt);
  const expected = normalizeWhitespace(gold);
  return Boolean(actual && expected && (actual.includes(expected) || expected.includes(actual)));
}

export function answerContainsGold(answer, gold) {
  const actual = normalizeWhitespace(answer).toLowerCase();
  const expected = normalizeWhitespace(gold).toLowerCase();
  return Boolean(expected && actual.includes(expected));
}

export function hitAtK(ranked, relevantIds, k) {
  return Number(ranked.slice(0, k).some((hit) => relevantIds.has(hit.chunk.id)));
}

export function rankMetrics(ranked, relevantIds) {
  const first = ranked.findIndex((hit) => relevantIds.has(hit.chunk.id));
  const dcg = ranked.slice(0, 10).reduce((sum, hit, index) => sum + (relevantIds.has(hit.chunk.id) ? 1 / Math.log2(index + 2) : 0), 0);
  const ideal = Array.from({ length: Math.min(relevantIds.size, 10) }, (_, index) => 1 / Math.log2(index + 2)).reduce((a, b) => a + b, 0);
  return { hitAt1: hitAtK(ranked, relevantIds, 1), hitAt3: hitAtK(ranked, relevantIds, 3), hitAt5: hitAtK(ranked, relevantIds, 5), hitAt10: hitAtK(ranked, relevantIds, 10), mrrAt10: first >= 0 && first < 10 ? 1 / (first + 1) : 0, ndcgAt10: ideal ? dcg / ideal : null };
}

export function proportion(rows, predicate) {
  const passed = rows.filter(predicate).length;
  return { passed, total: rows.length, rate: rows.length ? passed / rows.length : null };
}

export function averageMetrics(rows, key) {
  if (!rows.length) return null;
  return Object.fromEntries(Object.keys(rows[0][key].metrics).map((metric) => [metric, rows.reduce((sum, row) => sum + row[key].metrics[metric], 0) / rows.length]));
}

export function strictDecline(presentation) {
  return presentation.answer.trim() === DECLINE && presentation.evidence.length === 0 && presentation.confidence === "low";
}

export function factSupportsLabel(fact, label) {
  return fact.documentId === label.docId && evidenceContainsGold(fact.evidence, label.evidence);
}

// Check the actual labelled endpoints, not any relation somewhere in the hits.
export function relationsForLabelPair(result, leftLabel, rightLabel) {
  const facts = new Map(result.facts.map((fact) => [fact.id, fact]));
  return result.relations.filter((relation) => {
    const left = facts.get(relation.factIds[0]);
    const right = facts.get(relation.factIds[1]);
    return left && right && ((factSupportsLabel(left, leftLabel) && factSupportsLabel(right, rightLabel)) || (factSupportsLabel(right, leftLabel) && factSupportsLabel(left, rightLabel)));
  });
}
