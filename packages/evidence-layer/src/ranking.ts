import { rankCandidates } from "@fracta-flow/retrieval-core";
import { toRetrievalCandidate } from "./candidateAdapter";
import { classifyIntent } from "./intent";
import { workflowMultiplier } from "./workflow";
import { EVIDENCE_AUTHORITY_TIERS, type EvidenceHit, type EvidenceRecord, type WorkflowContext } from "./types";

/**
 * Tier-gated, workflow-aware evidence ranking.
 *
 * Unlike rag-work's own recency boost (a soft +1.2 nudge — see ranking.ts's
 * `versionIntent`/`newestEffectiveDate` handling), authority tier here is a
 * HARD gate: a weak-scoring tier-1 (current participant plan) result must
 * outrank a strong-scoring tier-4 (assessment evidence) result. A soft
 * additive boost can't guarantee that when the score gap is large enough,
 * so candidates are bucketed by tier first, and lower tiers are only
 * considered when a higher tier has zero results that clear retrieval-core's
 * own "enough support" gate (rankCandidates already drops anything that
 * doesn't clear it).
 */
export function rankEvidence(query: string, workflowContext: WorkflowContext, candidates: EvidenceRecord[], limit = 6): EvidenceHit[] {
  const eligible = candidates.filter((record) => record.approvalStatus === "approved");
  const matchedCategories = classifyIntent(query);
  const multiplier = workflowMultiplier(matchedCategories, workflowContext);

  for (const tier of EVIDENCE_AUTHORITY_TIERS) {
    const tierRecords = eligible.filter((record) => record.evidenceAuthorityTier === tier);
    if (!tierRecords.length) continue;

    const byRetrievalCandidateId = new Map(tierRecords.map((record) => [recordCandidateId(record), record]));
    const retrievalCandidates = tierRecords.map(toRetrievalCandidate);
    const hits = rankCandidates(query, retrievalCandidates, limit);
    if (!hits.length) continue;

    return hits.map((hit) => {
      const record = byRetrievalCandidateId.get(hit.chunk.id)!;
      return {
        record,
        tierIndex: EVIDENCE_AUTHORITY_TIERS.indexOf(tier),
        matchedCategories,
        workflowMultiplier: multiplier,
        baseScore: hit.score,
        finalScore: hit.score * multiplier,
      };
    });
  }

  return [];
}

function recordCandidateId(record: EvidenceRecord): string {
  return "chunk" in record ? record.chunk.id : record.id;
}
