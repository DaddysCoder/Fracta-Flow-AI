import type { IntentCategory, WorkflowContext } from "./types";

/**
 * Pure lookup table: which intent categories get weighted up (or down) when
 * the caller is inside a given FIELD workflow. `workflowContext` is supplied
 * explicitly by the host app's workflow engine — never inferred from the
 * query text — so this stays a deterministic, unit-testable multiplier
 * rather than a hidden heuristic.
 */
const WORKFLOW_CATEGORY_WEIGHTS: Record<WorkflowContext, Partial<Record<IntentCategory, number>>> = {
  daily_support: {
    proactive_strategy: 1.3,
    communication: 1.2,
  },
  incident: {
    incident_response: 2.0,
    restrictive_practice: 1.5,
    reactive_strategy: 1.5,
    risk: 1.3,
  },
  bsa_fba: {
    assessment_evidence: 2.0,
    risk: 1.3,
  },
  transport: {
    transport_safety: 2.0,
    proactive_strategy: 1.2,
  },
  intake_review: {
    assessment_evidence: 1.4,
    consent: 1.3,
  },
  consent_review: {
    consent: 2.0,
    restrictive_practice: 1.3,
  },
};

const DEFAULT_WEIGHT = 1.0;

/**
 * Combined multiplier for a candidate given the categories its query
 * matched and the current workflow context. Multiple matched categories
 * take the strongest (max) applicable weight rather than compounding, so a
 * query matching several categories can't snowball into an unbounded
 * multiplier.
 */
export function workflowMultiplier(matchedCategories: IntentCategory[], workflowContext: WorkflowContext): number {
  const weights = WORKFLOW_CATEGORY_WEIGHTS[workflowContext] ?? {};
  if (!matchedCategories.length) return DEFAULT_WEIGHT;
  return matchedCategories.reduce((max, category) => Math.max(max, weights[category] ?? DEFAULT_WEIGHT), DEFAULT_WEIGHT);
}
