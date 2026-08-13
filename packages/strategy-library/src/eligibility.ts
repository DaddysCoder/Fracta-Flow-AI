import type { EligibilityFilters } from "@fracta-flow/participant-profile";
import type { StrategyTemplate } from "./types";

/**
 * Eligibility filtering happens before a strategy ever appears in a list —
 * application logic, not an AI decision, and `EligibilityFilters` (age,
 * culturalConstraints) is never passed to an AI during personalisation.
 * That data-access boundary is already enforced by the Participant Profile
 * module's `getEligibilityFilters()` / `getPersonalisationContext()` split;
 * this module only consumes `getEligibilityFilters()`'s output, it does
 * not re-implement participant data access.
 *
 * STILL A DELIBERATE PASS-THROUGH: `StrategyTemplate.ageAppropriateness`
 * and `culturalSafetyFlag` exist (Fracta Flow branding + schema pass), but
 * neither is wired in here on purpose. Both are practitioner-authored
 * guidance surfaced as a visible note on the template detail view, not a
 * hard eligibility gate — there is no NDIS-defined age bracket for PBS
 * strategies to derive a real filter from, and turning a partially-filled,
 * free-text cultural note into silent exclusion logic would cross the
 * "no ranking/recommended-for-this-case logic beyond static category/
 * filter browsing" line Phase 1 draws. `isEligible` below stays a
 * pass-through: every template is eligible for every participant. If hard
 * age/culture exclusion is ever required, that's a product decision to
 * revisit deliberately, not something to back into via these fields.
 */
export function isEligible(_template: StrategyTemplate, _eligibility: EligibilityFilters): boolean {
  return true;
}

export function filterEligibleTemplates(
  templates: StrategyTemplate[],
  eligibility: EligibilityFilters
): StrategyTemplate[] {
  return templates.filter((template) => isEligible(template, eligibility));
}
