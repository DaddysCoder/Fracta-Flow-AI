import type { RetrievalHit } from "./types";
import { analyzePolicyIntelligence, type PolicyIntelligenceResult } from "./policy-intelligence";
import { antecedentPassage, decomposeQuery, evidenceKey, linkedPassage, passageSentences, validateSupport, type PassageSupport } from "./answer-support";

export type PresentedEvidence = { hit: RetrievalHit; excerpt: string };
export type AnswerConfidence = "high" | "medium" | "low";
export type AnswerPresentation = {
  answer: string;
  confidence: AnswerConfidence;
  retrievalConfidence: AnswerConfidence;
  evidence: PresentedEvidence[];
  support: {
    supportedFacets: number;
    totalFacets: number;
    coverage: number;
    facets: Array<{ question: string; supported: boolean; coverage: number; evidenceIndices: number[] }>;
    conflictingEvidence: boolean;
    corroborated: boolean;
  };
};

export const UNSUPPORTED_ANSWER = "I couldn't find enough support for that in the approved documents.";
type Candidate = PresentedEvidence & { rank: number; sentenceIndex: number; support: PassageSupport; score: number };

function retrievalConfidence(hits: readonly RetrievalHit[]): AnswerConfidence {
  const score = hits[0]?.score ?? 0;
  return score >= 3 ? "high" : score >= 1.3 ? "medium" : "low";
}

function sentenceStart(sentence: string): string {
  return /^[A-Z][a-z]/.test(sentence) ? sentence[0].toLowerCase() + sentence.slice(1) : sentence;
}

function relationSignals(intelligence: PolicyIntelligenceResult, evidence: PresentedEvidence[]) {
  const selected = new Set(intelligence.facts.filter((fact) => evidence.some((item) => item.hit.chunk.id === fact.chunkId && item.excerpt.includes(fact.evidence))).map((fact) => fact.id));
  const relevant = intelligence.relations.filter((relation) => relation.factIds.some((id) => selected.has(id)));
  return {
    conflictingEvidence: relevant.some((relation) => relation.kind === "possible_conflict"),
    corroborated: relevant.some((relation) => relation.kind === "same_rule" || relation.kind === "likely_same_rule"),
  };
}

function definitionBonus(question: string, excerpt: string): number {
  if (!/^what\s+(?:is|are|counts?\s+as|qualifies?\s+as)\b/i.test(question)) return 0;
  return /^(?:A|An|The)\s+.+?\s+(?:is|are|means?|includes?|refers?\s+to)\b/i.test(excerpt) ? 1.4 : 0;
}

function candidateFactIds(candidate: Candidate, intelligence: PolicyIntelligenceResult): Set<string> {
  return new Set(intelligence.facts
    .filter((fact) => fact.chunkId === candidate.hit.chunk.id && candidate.excerpt.includes(fact.evidence))
    .map((fact) => fact.id));
}

function corroborates(left: Candidate, right: Candidate, intelligence: PolicyIntelligenceResult): boolean {
  const leftIds = candidateFactIds(left, intelligence);
  const rightIds = candidateFactIds(right, intelligence);
  return intelligence.relations.some((relation) =>
    (relation.kind === "same_rule" || relation.kind === "likely_same_rule")
    && ((leftIds.has(relation.factIds[0]) && rightIds.has(relation.factIds[1]))
      || (leftIds.has(relation.factIds[1]) && rightIds.has(relation.factIds[0]))));
}

function relatedEvidenceCandidates(best: Candidate, intelligence: PolicyIntelligenceResult, hits: readonly RetrievalHit[]): Candidate[] {
  const bestIds = candidateFactIds(best, intelligence);
  const relatedIds = new Set(intelligence.relations
    .filter((relation) => (relation.kind === "same_rule" || relation.kind === "likely_same_rule") && relation.differences.length === 0)
    .flatMap((relation) => bestIds.has(relation.factIds[0]) ? [relation.factIds[1]] : bestIds.has(relation.factIds[1]) ? [relation.factIds[0]] : []));
  return intelligence.facts.flatMap((fact) => {
    if (!relatedIds.has(fact.id)) return [];
    const rank = hits.findIndex((hit) => hit.chunk.id === fact.chunkId);
    if (rank < 0) return [];
    return [{ hit: hits[rank], excerpt: fact.evidence, rank, sentenceIndex: 0, support: best.support, score: best.score - 0.1 }];
  });
}

function antecedentAnswerBonus(facetTerms: readonly string[], sentence: string, excerpt: string): number {
  if (sentence === excerpt || !/^(?:this|these|those|it|they|its|their)\b/i.test(sentence)) return 0;
  const sentenceTerms = sentence.toLowerCase().match(/[a-z]+/g) ?? [];
  return facetTerms.some((term) => sentenceTerms.some((word) => word.startsWith(term) || term.startsWith(word))) ? 0.8 : 0;
}

export function buildAnswerPresentation(query: string, hits: readonly RetrievalHit[], intelligence?: PolicyIntelligenceResult): AnswerPresentation {
  const policyIntelligence = intelligence ?? analyzePolicyIntelligence(query, [...hits]);
  const facets = decomposeQuery(query);
  const evidence: PresentedEvidence[] = [];
  const selected: Candidate[] = [];
  const outcomes: AnswerPresentation["support"]["facets"] = [];

  for (const facet of facets) {
    const candidates: Candidate[] = [];
    hits.forEach((hit, rank) => {
      if (!validateSupport(facet, hit.chunk.text, "retrieval", hit.document.originalName).direct) return;
      const sentences = passageSentences(hit.chunk.text, hit.document.originalName);
      sentences.forEach((sentence, sentenceIndex) => {
        // Adjacent context resolves local definitions, pronouns and enumerations.
        // It is kept verbatim with the supporting sentence, never used invisibly.
        const excerpts = [sentence, antecedentPassage(sentences, sentenceIndex)];
        for (let length = 2; length <= 3 && sentenceIndex + length <= sentences.length; length++) excerpts.push(linkedPassage(sentences, sentenceIndex, length));
        for (const excerpt of excerpts) {
          if (!excerpt) continue;
          const support = validateSupport(facet, excerpt, "sentence", `${hit.document.originalName} ${hit.chunk.text}`);
          if (!support.direct) continue;
          const specific = /\b(?:must|shall|requir(?:e|es|ed|ing)|only|prohibited|within|before|after|\d+)\b/i.test(excerpt) ? 0.65 : 0;
          const addedContext = excerpt === sentence ? 0 : 1;
          candidates.push({ hit, excerpt, rank, sentenceIndex, support, score: support.score + 1.25 / (rank + 1) + specific + definitionBonus(facet.question, excerpt) + antecedentAnswerBonus(facet.terms, sentence, excerpt) - addedContext * 0.2 });
          // Once the facet is directly supported, a longer window adds no value.
          break;
        }
      });
    });
    candidates.sort((a, b) => b.score - a.score || a.rank - b.rank || a.sentenceIndex - b.sentenceIndex);
    const best = candidates[0];
    const chosen = best ? [best] : [];
    // Multiple obligations in one chunk may answer a general question. Every
    // extra sentence must pass the same direct support gate as the first.
    if (best && facets.length === 1 && facet.kind !== "timeframe" && facet.kind !== "actor") {
      for (const candidate of candidates.slice(1)) {
        if (candidate.score < best.score - 1.5 || candidate.support.coverage < best.support.coverage - 0.2) continue;
        if (chosen.some((item) => evidenceKey(item.excerpt).includes(evidenceKey(candidate.excerpt)) || evidenceKey(candidate.excerpt).includes(evidenceKey(item.excerpt)))) continue;
        chosen.push(candidate);
        if (chosen.length >= 3) break;
      }
    }
    if (best && facets.length === 1) {
      for (const candidate of candidates.slice(1)) {
        if (!corroborates(best, candidate, policyIntelligence)) continue;
        if (chosen.some((item) => evidenceKey(item.excerpt) === evidenceKey(candidate.excerpt))) continue;
        chosen.push(candidate);
        if (chosen.length >= 3) break;
      }
      for (const candidate of relatedEvidenceCandidates(best, policyIntelligence, hits)) {
        if (chosen.some((item) => evidenceKey(item.excerpt) === evidenceKey(candidate.excerpt))) continue;
        chosen.push(candidate);
        if (chosen.length >= 3) break;
      }
    }
    const evidenceIndices: number[] = [];
    for (const candidate of chosen) {
      let index = evidence.findIndex((item) => evidenceKey(item.excerpt) === evidenceKey(candidate.excerpt));
      if (index < 0) {
        index = evidence.length;
        evidence.push({ hit: candidate.hit, excerpt: candidate.excerpt });
        selected.push(candidate);
      }
      evidenceIndices.push(index);
    }
    outcomes.push({ question: facet.question, supported: Boolean(best), coverage: best?.support.coverage ?? 0, evidenceIndices });
  }

  const supportedFacets = outcomes.filter((facet) => facet.supported).length;
  const coverage = outcomes.reduce((sum, facet) => sum + facet.coverage, 0) / Math.max(1, outcomes.length);
  const signals = evidence.length ? relationSignals(policyIntelligence, evidence) : { conflictingEvidence: false, corroborated: false };
  const complete = supportedFacets === facets.length;
  const direct = selected.length > 0 && selected.every((candidate) => candidate.support.direct && candidate.support.coverage >= 0.85);
  const retrievalReliable = selected.every((candidate) => candidate.rank < 3 && candidate.hit.score >= 1.3);
  const confidence: AnswerConfidence = !complete || signals.conflictingEvidence || coverage < 0.7 ? "low"
    : direct && retrievalReliable && (coverage >= 0.95 || signals.corroborated) ? "high" : "medium";
  const statements = evidence.map(({ excerpt }, index) => `The approved guidance says ${sentenceStart(excerpt)} [${index + 1}]`);
  const missing = outcomes.filter((facet) => !facet.supported).map((facet) => `I couldn't find support for: ${facet.question.replace(/[?.,;]+$/, "")}.`);
  if (signals.conflictingEvidence) statements.push("The approved documents contain potentially conflicting provisions; the cited evidence does not establish a single agreed rule.");

  return {
    answer: evidence.length ? [...statements, ...missing].join("\n\n") : UNSUPPORTED_ANSWER,
    confidence: evidence.length ? confidence : "low",
    retrievalConfidence: retrievalConfidence(hits),
    evidence,
    support: { supportedFacets, totalFacets: facets.length, coverage, facets: outcomes, ...signals },
  };
}

export function supportedPolicyIntelligence(intelligence: PolicyIntelligenceResult, presentation: AnswerPresentation): PolicyIntelligenceResult | null {
  if (!presentation.evidence.length) return null;
  const selected = new Set(intelligence.facts.filter((fact) => presentation.evidence.some((item) => item.hit.chunk.id === fact.chunkId && item.excerpt.includes(fact.evidence))).map((fact) => fact.id));
  const relations = intelligence.relations.filter((relation) => relation.factIds.some((id) => selected.has(id)));
  const visible = new Set([...selected, ...relations.flatMap((relation) => relation.factIds)]);
  const facts = intelligence.facts.filter((fact) => visible.has(fact.id));
  if (!facts.length) return null;
  return {
    ...intelligence, facts, relations,
    insights: intelligence.insights.filter((insight) => visible.has(insight.factId)).map((insight) => ({
      ...insight,
      corroboratingFactIds: insight.corroboratingFactIds.filter((id) => visible.has(id)),
      possibleConflicts: insight.possibleConflicts.filter((conflict) => visible.has(conflict.factId)),
    })),
    unresolved: intelligence.unresolved.filter((item) => presentation.evidence.some((evidence) => evidence.hit.chunk.id === item.chunkId)),
  };
}
