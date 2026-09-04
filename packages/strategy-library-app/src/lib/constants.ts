import type { StrategyCategory, EvidenceTier } from "@fracta-flow/strategy-library/core";
import type { EvidenceAuthorityTier, IntentCategory, WorkflowContext } from "@fracta-flow/evidence-layer/core";

export const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  environmental: "Environmental",
  community: "Community",
  communication: "Communication",
  regulating: "Regulating",
  health_wellbeing: "Health and Wellbeing",
  learning: "Learning",
};

export const CATEGORY_ORDER: StrategyCategory[] = [
  "environmental",
  "community",
  "communication",
  "regulating",
  "health_wellbeing",
  "learning",
];

export const EVIDENCE_TIER_LABELS: Record<EvidenceTier, string> = {
  systematic_review: "Systematic review",
  rct: "RCT",
  single_study: "Single study",
  practice_guide: "Practice guide",
  expert_consensus: "Expert consensus",
  mixed_package_level: "Mixed (package-level)",
};

export const EVIDENCE_TIER_ORDER: EvidenceTier[] = [
  "systematic_review",
  "rct",
  "single_study",
  "practice_guide",
  "expert_consensus",
  "mixed_package_level",
];

/**
 * The FBA tool's 6-phase escalation cycle model, reused directly per the
 * brief for scaling Responsive strategies. Its source isn't in this
 * repo, so this is the model re-declared from its description — display
 * only, informational context for the practitioner. It never filters or
 * ranks strategies: Phase 1 explicitly excludes any
 * recommended-for-this-case logic.
 */
export const ESCALATION_PHASES = [
  "baseline",
  "early_warning",
  "escalation",
  "peak",
  "de-escalation",
  "recovery",
] as const;

export type EscalationPhase = (typeof ESCALATION_PHASES)[number];

export const ESCALATION_PHASE_LABELS: Record<EscalationPhase, string> = {
  baseline: "Baseline",
  early_warning: "Early warning",
  escalation: "Escalation",
  peak: "Peak",
  "de-escalation": "De-escalation",
  recovery: "Recovery",
};

export const EVIDENCE_AUTHORITY_TIER_LABELS: Record<EvidenceAuthorityTier, string> = {
  current_participant_plan: "Current participant plan",
  interim_authorised: "Interim authorised instruction",
  org_procedure_current: "Current organisational procedure",
  assessment_evidence: "Assessment evidence",
  historical_superseded: "Historical / superseded",
};

export const WORKFLOW_CONTEXT_LABELS: Record<WorkflowContext, string> = {
  daily_support: "Daily support",
  incident: "Incident",
  bsa_fba: "BSA / FBA",
  transport: "Transport",
  intake_review: "Intake review",
  consent_review: "Consent review",
};

export const WORKFLOW_CONTEXTS: WorkflowContext[] = [
  "daily_support",
  "incident",
  "bsa_fba",
  "transport",
  "intake_review",
  "consent_review",
];

export const INTENT_CATEGORY_LABELS: Record<IntentCategory, string> = {
  proactive_strategy: "Proactive strategy",
  reactive_strategy: "Reactive strategy",
  incident_response: "Incident response",
  transport_safety: "Transport safety",
  restrictive_practice: "Restrictive practice",
  communication: "Communication",
  risk: "Risk",
  consent: "Consent",
  assessment_evidence: "Assessment evidence",
  staff_instruction: "Staff instruction",
  medication: "Medication",
};
