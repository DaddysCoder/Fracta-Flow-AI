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
 * IMPORTANT SCHEMA GAP: the v2 StrategyTemplate schema does not (yet)
 * define any per-template age-range or cultural-exclusion fields to filter
 * against — `population` is "what the evidence studied", not an
 * age/culture exclusion list, and nothing else on the template carries
 * that metadata. So `isEligible` below is currently a pass-through: every
 * template is eligible for every participant. This is intentionally NOT
 * papered over with invented heuristics (e.g. keyword-matching
 * `culturalConstraints` text against `contraindications`), since Phase 1
 * explicitly excludes "any ranking or recommended-for-this-case logic
 * beyond static category/filter browsing" and inventing semantic matching
 * would cross that line. Flagging for the product owner: if hard
 * age/culture exclusion is required before Phase 1 ships, StrategyTemplate
 * needs explicit fields for it first.
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
