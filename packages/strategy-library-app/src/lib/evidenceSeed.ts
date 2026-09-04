import type {
  Chunk,
  KnowledgeDocument,
} from "@fracta-flow/retrieval-core";
import type {
  ApprovalStatus,
  EvidenceAuthorityTier,
  EvidenceChunkRecord,
  EvidenceRecord,
  StructuredKnowledgeRecord,
} from "@fracta-flow/evidence-layer";

/**
 * Mock evidence candidates for the Evidence Search view.
 *
 * There is no live evidence backend yet — `strategy-library-server` only
 * exposes a personalisation-drafting route (see
 * `packages/strategy-library-server/src/routes/personalize.ts`), nothing
 * evidence-shaped. This module stands in for that future source, in the
 * same spirit as `@fracta-flow/strategy-library`'s `SEED_TEMPLATES`:
 * bundled, in-memory, read-only content the UI queries through the real
 * `rankEvidence` engine so the ranking/tiering/workflow-weighting behaviour
 * on screen is the real thing, not a mock of it.
 *
 * Two records here are deliberately NOT eligible, to exercise the
 * boundaries `rankEvidence`/the host are each responsible for enforcing:
 * - `procedure-quarantined` — `approvalStatus: "quarantined"`, filtered by
 *   `rankEvidence` itself (only "approved" evidence is ever eligible).
 * - `participant-2-plan` — `participantRef: "seed-participant-2"`, filtered
 *   by `buildEvidenceCandidates` below (participant scoping is the HOST
 *   app's responsibility, per evidence-layer's HANDOFF/tests — evidence-
 *   layer only ranks whatever candidate list it's given).
 */

const SEED_PARTICIPANT_ONE = "seed-participant-1";
const SEED_PARTICIPANT_TWO = "seed-participant-2";

function structuredRecord(overrides: Partial<StructuredKnowledgeRecord> & Pick<StructuredKnowledgeRecord, "id">): StructuredKnowledgeRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2025-01-01",
    current: true,
    supersededBy: null,
    evidenceAuthorityTier: "org_procedure_current",
    participantRef: null,
    sourceDocumentId: `doc-${overrides.id}`,
    strategyType: "",
    behaviourRisk: "",
    triggerContext: "",
    earlyWarningSign: "",
    staffAction: "",
    staffActionToAvoid: "",
    ...overrides,
  };
}

function chunkDocument(id: string, name: string, status: ApprovalStatus, effectiveDate: string): KnowledgeDocument {
  return {
    id,
    name,
    originalName: name,
    mimeType: "text/plain",
    size: 0,
    contentHash: id,
    status,
    uploadedAt: effectiveDate,
    effectiveDate,
    inspection: {
      wordCount: 0,
      possiblePersonalInfo: false,
      possibleSupersededLanguage: false,
      possibleSecrets: false,
      possiblePromptInjection: false,
      lowTextContent: false,
      notes: [],
    },
  };
}

function chunkRecord(
  id: string,
  overrides: Partial<EvidenceChunkRecord> & { text: string; documentName: string; tier: EvidenceAuthorityTier }
): EvidenceChunkRecord {
  const documentId = `doc-${id}`;
  const effectiveDate = overrides.effectiveDate ?? "2025-01-01";
  const chunk: Chunk = { id, documentId, index: 0, text: overrides.text };
  return {
    id,
    approvalStatus: "approved",
    version: 1,
    effectiveDate,
    current: true,
    supersededBy: null,
    evidenceAuthorityTier: overrides.tier,
    participantRef: null,
    sourceDocumentId: documentId,
    chunk,
    document: chunkDocument(documentId, overrides.documentName, "approved", effectiveDate),
    ...overrides,
  };
}

/** Org-wide procedures/policy — visible to every participant context. */
const ORG_WIDE_RECORDS: EvidenceRecord[] = [
  structuredRecord({
    id: "proc-transport-seatbelt",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "transport safety check",
    behaviourRisk: "attempts to unbuckle seatbelt while vehicle is moving",
    triggerContext: "car ride, bus travel, transport transitions",
    earlyWarningSign: "hands moving toward buckle, increased vocalisation",
    staffAction: "use a seatbelt cover, narrate the trip, offer a sensory item before departure",
    staffActionToAvoid: "do not raise your voice or grab the participant's hands",
  }),
  structuredRecord({
    id: "proc-incident-debrief",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "post-incident debrief",
    behaviourRisk: "critical incident involving risk to self or others",
    triggerContext: "immediately after an incident",
    earlyWarningSign: "n/a — reactive procedure",
    staffAction: "complete the incident report within 24 hours and offer the participant a debrief in their preferred communication mode",
    staffActionToAvoid: "do not discuss the incident in front of other participants",
  }),
  structuredRecord({
    id: "proc-restrictive-authorisation",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "restrictive practice authorisation check",
    behaviourRisk: "any use of restraint or seclusion",
    triggerContext: "before any restrictive practice is used",
    earlyWarningSign: "escalation beyond de-escalation strategies",
    staffAction: "confirm current authorisation is on file before using any restrictive practice; use the least restrictive option authorised",
    staffActionToAvoid: "never use an unauthorised restrictive practice, even in a crisis",
  }),
  structuredRecord({
    id: "proc-consent-guardian",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "consent verification",
    behaviourRisk: "n/a — administrative procedure",
    triggerContext: "before sharing records or starting a new strategy",
    earlyWarningSign: "n/a",
    staffAction: "confirm the authorised representative's consent is current before proceeding",
    staffActionToAvoid: "do not proceed on verbal consent alone where written consent is required",
  }),
  structuredRecord({
    id: "proc-communication-aac",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "AAC-first communication",
    behaviourRisk: "n/a — proactive support",
    triggerContext: "any interaction requiring a choice or instruction",
    earlyWarningSign: "n/a",
    staffAction: "lead with the participant's AAC device or communication board before spoken language",
    staffActionToAvoid: "do not repeat spoken instructions faster or louder if unanswered",
  }),
  structuredRecord({
    id: "proc-historical-seatbelt-2022",
    evidenceAuthorityTier: "historical_superseded",
    current: false,
    supersededBy: "proc-transport-seatbelt",
    effectiveDate: "2022-03-01",
    strategyType: "transport safety check (2022 version)",
    behaviourRisk: "attempts to unbuckle seatbelt while vehicle is moving",
    triggerContext: "car ride",
    earlyWarningSign: "hands near buckle",
    staffAction: "firmly remind the participant seatbelts must stay on",
    staffActionToAvoid: "",
  }),
  structuredRecord({
    id: "proc-quarantined-medication",
    approvalStatus: "quarantined",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "PRN medication note (under review)",
    behaviourRisk: "self-injurious behaviour",
    triggerContext: "medication window",
    earlyWarningSign: "reported pain",
    staffAction: "flagged during ingestion screening — pending manual review, not yet eligible for retrieval",
    staffActionToAvoid: "",
  }),
  chunkRecord("chunk-fba-observation-protocol", {
    text: "Functional behaviour assessment observation protocol: record antecedent, behaviour, and consequence for each observed incident using the standard ABC data sheet. Assessment evidence must be gathered across at least three settings before a hypothesis is finalised.",
    documentName: "FBA Observation Protocol",
    tier: "assessment_evidence",
  }),
  chunkRecord("chunk-risk-hazard-review", {
    text: "Environmental hazard review checklist: identify sensory triggers (fluorescent lighting, unexpected loud alarms), physical safety hazards, and transport risk factors as part of every quarterly risk review.",
    documentName: "Environmental Risk Review Checklist",
    tier: "assessment_evidence",
  }),
];

/**
 * Participant-specific current plan records, keyed by a fixed demo
 * participant id. In this bundled seed data these ids won't match a real
 * local participant created via `ParticipantPicker` (those get a fresh
 * `crypto.randomUUID()`), so in normal use these records simply never
 * surface — that's expected and still demonstrates the scoping contract
 * correctly (nothing here leaks into an unrelated participant's results).
 */
const PARTICIPANT_SCOPED_RECORDS: Record<string, EvidenceRecord[]> = {
  [SEED_PARTICIPANT_ONE]: [
    structuredRecord({
      id: "plan-p1-fire-alarm",
      evidenceAuthorityTier: "current_participant_plan",
      participantRef: SEED_PARTICIPANT_ONE,
      strategyType: "sensory break",
      behaviourRisk: "distress during unplanned loud fire alarm drills",
      triggerContext: "fire alarm, sudden loud noise",
      earlyWarningSign: "hands over ears, seeking exit",
      staffAction: "offer noise-cancelling headphones and move to the identified quiet corridor",
      staffActionToAvoid: "do not physically guide by the arm without an offered hand first",
    }),
  ],
  [SEED_PARTICIPANT_TWO]: [
    structuredRecord({
      id: "plan-p2-transport",
      evidenceAuthorityTier: "current_participant_plan",
      participantRef: SEED_PARTICIPANT_TWO,
      strategyType: "transport de-escalation",
      behaviourRisk: "refuses to enter the vehicle",
      triggerContext: "transport transitions",
      earlyWarningSign: "stepping back from the car",
      staffAction: "use the participant's visual transition schedule before approaching the vehicle",
      staffActionToAvoid: "do not rush the transition",
    }),
  ],
};

/**
 * Builds the candidate list a query is actually allowed to run against:
 * every org-wide record, plus — only when it belongs to the participant
 * currently in view — that participant's own scoped records. This is the
 * host-side half of participant scoping evidence-layer's tests document as
 * its responsibility (`rankEvidence` itself performs no further mixing,
 * but it also does no scoping of its own — the candidate list handed to it
 * must already be correctly scoped). A record scoped to any OTHER
 * participant is never included here, so it can never appear in results
 * regardless of query text.
 */
export function buildEvidenceCandidates(activeParticipantId: string | null): EvidenceRecord[] {
  const scoped = activeParticipantId ? PARTICIPANT_SCOPED_RECORDS[activeParticipantId] ?? [] : [];
  return [...ORG_WIDE_RECORDS, ...scoped];
}

export const DEMO_SCOPED_PARTICIPANT_IDS = [SEED_PARTICIPANT_ONE, SEED_PARTICIPANT_TWO];
