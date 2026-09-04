import type { EvidenceAuthorityTier, StructuredKnowledgeRecord, WorkflowContext } from "../src/types";

/**
 * Starter fixture set for evidence-layer's own quality gate — the FIELD
 * analogue of rag-work's benchmark/v2. Deliberately small (FIELD has no
 * existing hand-labelled PBS corpus the way rag-work has its regulatory
 * one); grow this over time as real query logs and real PBS content become
 * available, following the same shape.
 */
export interface BenchmarkQuestion {
  id: string;
  query: string;
  workflowContext: WorkflowContext;
  expectedRecordId: string;
  expectedTier: EvidenceAuthorityTier;
}

function record(fields: Partial<StructuredKnowledgeRecord> & Pick<StructuredKnowledgeRecord, "id" | "evidenceAuthorityTier">): StructuredKnowledgeRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    participantRef: "participant-1",
    sourceDocumentId: `doc-${fields.id}`,
    strategyType: "",
    behaviourRisk: "",
    triggerContext: "",
    earlyWarningSign: "",
    staffAction: "",
    staffActionToAvoid: "",
    ...fields,
  };
}

export const RECORDS: StructuredKnowledgeRecord[] = [
  record({
    id: "sensory-break-current",
    evidenceAuthorityTier: "current_participant_plan",
    strategyType: "sensory break",
    triggerContext: "loud fire alarm drills",
    earlyWarningSign: "covering ears, pacing near the exit",
    staffAction: "offer noise-cancelling headphones and a quiet break room during fire alarm drills",
    staffActionToAvoid: "do not force continued participation in the drill",
  }),
  record({
    id: "sensory-break-superseded",
    evidenceAuthorityTier: "historical_superseded",
    current: false,
    supersededBy: "sensory-break-current",
    strategyType: "sensory break",
    triggerContext: "loud fire alarm drills",
    staffAction: "move the participant to another room without warning during alarm drills",
  }),
  record({
    id: "seatbelt-transport",
    evidenceAuthorityTier: "current_participant_plan",
    strategyType: "seatbelt reminder",
    triggerContext: "entering the vehicle",
    staffAction: "give a seatbelt reminder every time before the vehicle moves",
  }),
  record({
    id: "incident-debrief-procedure",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "incident response",
    triggerContext: "after any critical incident",
    staffAction: "complete the incident report and hold a debrief within 24 hours of the incident",
  }),
  record({
    id: "restrictive-practice-authorisation",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "restrictive practice",
    triggerContext: "any use of physical restraint",
    staffAction: "confirm restrictive practice authorisation is current before any restraint is used",
  }),
  record({
    id: "fba-risk-notes",
    evidenceAuthorityTier: "assessment_evidence",
    strategyType: "functional behaviour assessment",
    triggerContext: "unstructured transition periods",
    staffAction: "record observation data on risk during unstructured transitions for the functional behaviour assessment",
  }),
  record({
    id: "consent-substitute-decision",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "consent",
    triggerContext: "any new restrictive practice",
    staffAction: "confirm guardian consent from the authorised substitute decision maker before proceeding",
  }),
  record({
    id: "medication-prn",
    evidenceAuthorityTier: "current_participant_plan",
    strategyType: "medication",
    triggerContext: "escalating distress not resolved by other strategies",
    staffAction: "follow the PRN medication protocol and record the dose and time given",
  }),
  record({
    id: "communication-aac",
    evidenceAuthorityTier: "current_participant_plan",
    strategyType: "communication",
    triggerContext: "any interaction",
    staffAction: "use the AAC device and simple direct language for all communication",
  }),
  record({
    id: "staff-handover-instruction",
    evidenceAuthorityTier: "org_procedure_current",
    strategyType: "staff instruction",
    triggerContext: "shift handover",
    staffAction: "read the shift handover notes before starting a shift",
  }),
];

export const QUESTIONS: BenchmarkQuestion[] = [
  { id: "Q1", query: "sensory break fire alarm", workflowContext: "daily_support", expectedRecordId: "sensory-break-current", expectedTier: "current_participant_plan" },
  { id: "Q2", query: "seatbelt reminder before the vehicle moves", workflowContext: "transport", expectedRecordId: "seatbelt-transport", expectedTier: "current_participant_plan" },
  { id: "Q3", query: "incident report debrief", workflowContext: "incident", expectedRecordId: "incident-debrief-procedure", expectedTier: "org_procedure_current" },
  { id: "Q4", query: "restraint authorisation restrictive practice", workflowContext: "incident", expectedRecordId: "restrictive-practice-authorisation", expectedTier: "org_procedure_current" },
  { id: "Q5", query: "functional behaviour assessment risk observation", workflowContext: "bsa_fba", expectedRecordId: "fba-risk-notes", expectedTier: "assessment_evidence" },
  { id: "Q6", query: "guardian consent substitute decision maker", workflowContext: "consent_review", expectedRecordId: "consent-substitute-decision", expectedTier: "org_procedure_current" },
  { id: "Q7", query: "PRN medication protocol dose", workflowContext: "daily_support", expectedRecordId: "medication-prn", expectedTier: "current_participant_plan" },
  { id: "Q8", query: "AAC device communication", workflowContext: "daily_support", expectedRecordId: "communication-aac", expectedTier: "current_participant_plan" },
  { id: "Q9", query: "shift handover notes", workflowContext: "daily_support", expectedRecordId: "staff-handover-instruction", expectedTier: "org_procedure_current" },
  {
    id: "Q10-supersession",
    query: "sensory break fire alarm",
    workflowContext: "daily_support",
    expectedRecordId: "sensory-break-current",
    expectedTier: "current_participant_plan",
  },
];
