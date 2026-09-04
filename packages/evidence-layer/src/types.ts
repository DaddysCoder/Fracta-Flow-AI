import type { Chunk, KnowledgeDocument } from "@fracta-flow/retrieval-core";

/**
 * Reuses rag-work's exact document lifecycle states (see rag-work's
 * src/lib/types.ts DocumentStatus) — only "approved" evidence is ever
 * eligible for retrieval, enforced at the query boundary, not as a ranking
 * penalty.
 */
export type ApprovalStatus = "needs_review" | "approved" | "rejected" | "quarantined";

/**
 * Authority/currency hierarchy, distinct from retrieval-core's
 * `EvidenceTier` concept in strategy-library (which grades the strength of
 * the underlying research — systematic review vs practice guide). This tier
 * instead grades *who this evidence is authoritative for right now*: a
 * weak-scoring current participant plan must still outrank a strong-scoring
 * historical document. Order matters — index 0 is highest authority.
 */
export const EVIDENCE_AUTHORITY_TIERS = [
  "current_participant_plan",
  "interim_authorised",
  "org_procedure_current",
  "assessment_evidence",
  "historical_superseded",
] as const;

export type EvidenceAuthorityTier = (typeof EVIDENCE_AUTHORITY_TIERS)[number];

export interface EvidenceRecordBase {
  id: string;
  approvalStatus: ApprovalStatus;
  version: number;
  effectiveDate: string;
  /** Exactly one record may be `current: true` per (participantRef, strategyType, triggerContext) — see supersession.ts. */
  current: boolean;
  supersededBy: string | null;
  evidenceAuthorityTier: EvidenceAuthorityTier;
  /** null = org-wide (procedure/policy), not tied to a specific participant. */
  participantRef: string | null;
  sourceDocumentId: string;
}

/**
 * Discrete, authored knowledge — participant-specific plans/instructions,
 * staff instructions, transport safety notes, consent records, etc. This IS
 * the answer; unlike EvidenceChunkRecord it doesn't need extractive snippet
 * selection. Deliberately separate from strategy-library's
 * StrategyTemplate/PersonalisationRecord: PBS knowledge (a staff instruction
 * for transport safety, a consent record) is broader than "a personalised
 * strategy," so this type doesn't replace or modify those — it can
 * optionally reference one via `linkedStrategyTemplateId`.
 */
export interface StructuredKnowledgeRecord extends EvidenceRecordBase {
  strategyType: string;
  behaviourRisk: string;
  triggerContext: string;
  earlyWarningSign: string;
  staffAction: string;
  staffActionToAvoid: string;
  linkedStrategyTemplateId?: string;
}

/**
 * Free-text source material (org policy PDFs, assessment reports,
 * regulatory documents) ingested and chunked via retrieval-core's
 * `chunkText`, still requiring extractive excerpting at answer time.
 */
export interface EvidenceChunkRecord extends EvidenceRecordBase {
  chunk: Chunk;
  /** Full ingested-document metadata, produced by retrieval-core's `buildDocument` — required by `rankCandidates` (title/effectiveDate/inspection all feed its scoring). */
  document: KnowledgeDocument;
}

export type EvidenceRecord = StructuredKnowledgeRecord | EvidenceChunkRecord;

export function isStructuredKnowledgeRecord(record: EvidenceRecord): record is StructuredKnowledgeRecord {
  return "strategyType" in record;
}

export function isEvidenceChunkRecord(record: EvidenceRecord): record is EvidenceChunkRecord {
  return "chunk" in record;
}

export type WorkflowContext =
  | "daily_support"
  | "incident"
  | "bsa_fba"
  | "transport"
  | "intake_review"
  | "consent_review";

export type IntentCategory =
  | "proactive_strategy"
  | "reactive_strategy"
  | "incident_response"
  | "transport_safety"
  | "restrictive_practice"
  | "communication"
  | "risk"
  | "consent"
  | "assessment_evidence"
  | "staff_instruction"
  | "medication";

export interface EvidenceHit {
  record: EvidenceRecord;
  tierIndex: number;
  matchedCategories: IntentCategory[];
  workflowMultiplier: number;
  baseScore: number;
  finalScore: number;
}
