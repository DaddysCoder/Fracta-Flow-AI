import type { EligibilityFilters } from "@fracta-flow/participant-profile";
import type { EvidenceRecord, IntentCategory } from "@fracta-flow/evidence-layer";
import type { AgeBand, DecodedEligibility, DiagnosisCategory } from "./types";

/**
 * STUB adapter — a concrete starting point for the next real integration,
 * not a finished one. Two separate, deliberately narrow wiring points:
 *
 * 1. `toEligibilityFilters` — decoded eligibility -> participant-profile's
 *    `EligibilityFilters` shape, so a Frame-sourced code can drive the same
 *    `filterEligibleTemplates`-style pre-filtering the Strategy Library
 *    already applies to a locally-known participant (see
 *    `packages/strategy-library/src/eligibility.ts`). This is intentionally
 *    lossy: Frame gives a de-identified age *band*, never an exact age, so
 *    `age` here is the band's midpoint, not a real age — treat it as
 *    advisory, same as `isEligible`'s current pass-through, never as a
 *    precise value.
 *
 * 2. `restrictToOrgWideEvidence` + `buildEligibilityAwareQuery` — how a
 *    decoded code feeds `rankEvidence` (evidence-layer). A Frame code never
 *    carries a `participantRef`, so FIELD has no basis to select a
 *    *specific* participant's plan from it — only org-wide/procedural
 *    evidence (`participantRef === null`, e.g. `org_procedure_current`,
 *    `assessment_evidence`) is ever in scope for an eligibility-code-only
 *    lookup. The diagnosis category is folded into the query text (not into
 *    ranking.ts's scoring internals) so it flows through the existing,
 *    already-tested `classifyIntent` -> `workflowMultiplier` pipeline
 *    untouched — no evidence-layer source file needed to change for this
 *    stub to compose with it.
 */

// STUB: band midpoint standing in for an exact age — a lossy approximation, treat as advisory only.
const AGE_BAND_MIDPOINT: Readonly<Record<AgeBand, number>> = {
  "0-5": 3,
  "6-12": 9,
  "13-17": 15,
  "18-24": 21,
  "25-64": 44,
  "65+": 70,
};

export function toEligibilityFilters(decoded: DecodedEligibility): EligibilityFilters {
  return {
    age: AGE_BAND_MIDPOINT[decoded.ageBand],
    // Frame's bucket carries no cultural-constraints text at all (it isn't
    // a dimension of this de-identified code) — leave it unset rather than
    // guessing, so downstream filtering never treats "unknown" as "none".
    culturalConstraints: "",
  };
}

/**
 * STUB: illustrative-only diagnosis -> query-hint terms, chosen to line up
 * with evidence-layer's existing `INTENT_TRIGGERS` phrases (see
 * `packages/evidence-layer/src/intent.ts`) purely so this compiles into a
 * runnable demonstration. Not a clinical mapping — a real one needs input
 * from whoever owns the real Frame<->FIELD taxonomy decision.
 */
const DIAGNOSIS_QUERY_HINTS: Readonly<Record<DiagnosisCategory, string>> = {
  autism: "communication proactive strategy",
  intellectual_disability: "proactive strategy communication",
  psychosocial_disability: "risk safety concern",
  acquired_brain_injury: "risk safety concern assessment",
  other_developmental: "proactive strategy",
};

/** Which `IntentCategory` values each diagnosis hint is expected to surface — used only by this package's own tests to prove the hint actually reaches `classifyIntent`. */
export const DIAGNOSIS_EXPECTED_CATEGORIES: Readonly<Record<DiagnosisCategory, IntentCategory[]>> = {
  autism: ["communication", "proactive_strategy"],
  intellectual_disability: ["proactive_strategy", "communication"],
  psychosocial_disability: ["risk"],
  acquired_brain_injury: ["risk", "assessment_evidence"],
  other_developmental: ["proactive_strategy"],
};

/** Appends the decoded eligibility's diagnosis-category hint to a caller's query text, before it reaches `rankEvidence`. */
export function buildEligibilityAwareQuery(baseQuery: string, decoded: DecodedEligibility): string {
  return `${baseQuery} ${DIAGNOSIS_QUERY_HINTS[decoded.diagnosisCategory]}`;
}

/**
 * Narrows candidates to org-wide evidence only (`participantRef === null`)
 * — the only evidence an eligibility-code-only lookup (no participant
 * identity, ever) has any basis to select. Call this before `rankEvidence`
 * whenever the only participant context available is a decoded Frame code.
 */
export function restrictToOrgWideEvidence(candidates: EvidenceRecord[]): EvidenceRecord[] {
  return candidates.filter((record) => record.participantRef === null);
}
