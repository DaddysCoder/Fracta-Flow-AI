import { baseTokens, queryTokens } from "./text-search";
import type { Chunk, RetrievalHit } from "./types";

export { rankCandidates } from "./ranking";
export type { RetrievalCandidate } from "./ranking";

/**
 * Ported from rag-work's src/lib/retrieval.ts. The original `retrieve()` is
 * intentionally dropped here — it called rag-work's own `store.ts`
 * (Postgres/local-file persistence with no tenant/participant column), which
 * is exactly the coupling this package exists to avoid. Host apps own their
 * own candidate lookup (participant/org scoped) and call `rankCandidates`
 * directly; only the pure extract/answer-assembly logic is re-exported here.
 */

function sentenceScore(sentence: string, terms: string[]) {
  const tokens = baseTokens(sentence);
  const set = new Set(tokens);
  let score = terms.filter((term) => set.has(term)).length;
  if (/\b(must|required|should|before|after|then|step|procedure|process)\b/i.test(sentence)) score += 0.35;
  return score / Math.sqrt(Math.max(tokens.length, 1));
}

function bestExtract(chunk: Chunk, terms: string[], sentenceCount = 2, maxLength = 520) {
  const sentences = chunk.text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length < 2) return chunk.text.replace(/\s+/g, " ").trim().slice(0, maxLength);
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, sentenceCount)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" ");
  return (ranked || sentences[0]).slice(0, maxLength);
}

/**
 * The evidence/source excerpt shown in the UI. Query-relevant sentences within the
 * chunk are surfaced (same scoring as the answer body) rather than the chunk's raw
 * opening characters, which is frequently mid-sentence boilerplate carried over from
 * fixed-size chunking and can land far from the sentence that actually answers the
 * query.
 */
export function excerptFor(query: string, chunk: Chunk) {
  const terms = queryTokens(query);
  return bestExtract(chunk, terms, 2, 560).replace(/\s+/g, " ").trim();
}

export function buildExtractiveAnswer(query: string, hits: RetrievalHit[]) {
  if (!hits.length) {
    return {
      answer: "I couldn't find enough support for that in the approved documents.",
      confidence: "low" as const,
    };
  }

  const terms = queryTokens(query);
  const seen = new Set<string>();
  const snippets: string[] = [];
  for (const hit of hits) {
    const extract = bestExtract(hit.chunk, terms).replace(/\s+/g, " ").trim();
    const fingerprint = extract.toLowerCase().slice(0, 120);
    if (!extract || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    snippets.push(`[${snippets.length + 1}] ${extract}`);
    if (snippets.length >= 3) break;
  }

  return {
    answer: `${snippets.join("\n\n")}\n\nRetrieved by local logic only. No external AI or API was used. Verify the cited source before acting on it.`,
    confidence: hits[0].score >= 3 ? ("high" as const) : hits[0].score >= 1.3 ? ("medium" as const) : ("low" as const),
  };
}
