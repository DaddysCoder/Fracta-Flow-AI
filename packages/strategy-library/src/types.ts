/**
 * Strategy Library data model.
 *
 * Three separate entities, deliberately not one flat model:
 * - StrategySource: a citation.
 * - StrategyTemplate: shared, versioned, centrally-hosted evidence-based
 *   content. Not participant data.
 * - PersonalisationRecord: local, participant-linked, practitioner-authored.
 *   Pins the template version it was created against so a later content
 *   correction never silently rewrites what a practitioner already
 *   selected and is accountable for.
 *
 * No function-of-behaviour tagging exists on StrategyTemplate, now or
 * ever — FunctionHypothesis matching from the FBA tool is deferred to
 * Phase 5+, and when/if it exists it happens outside the strategy's own
 * record, never by tagging the strategy itself with a function.
 */

export type PublisherType =
  | "government_funded"
  | "academic_open"
  | "academic_paywalled_cite_only";

export interface StrategySource {
  id: string;
  title: string;
  authors: string;
  publicationYear: number;
  urlOrDoi: string | null;
  publisherType: PublisherType;
}

/**
 * The six proactive categories (multi-select), plus the separate
 * Responsive category tracked via `isResponsive` on StrategyTemplate
 * rather than as a seventh value here — Responsive strategies render in
 * their own UI section, never mixed into the category filter.
 */
export type StrategyCategory =
  | "environmental"
  | "community"
  | "communication"
  | "regulating"
  | "health_wellbeing"
  | "learning";

export type EvidenceTier =
  | "systematic_review"
  | "rct"
  | "single_study"
  | "practice_guide"
  | "expert_consensus"
  | "mixed_package_level";

export type CapacityConsideration = "physical" | "cognitive" | "communication" | "sensory";

/**
 * Authored once by whoever creates the StrategyTemplate entry — never
 * inferred by the AI at runtime. At personalisation time, which declared
 * axis actually applies for a given participant is a data-availability
 * check against the Participant Profile, not a judgement call.
 */
export type PersonalisationAxis = "interests" | "communication_style";

export interface StrategyTemplate {
  id: string;
  /** Increments on any content edit. */
  version: number;
  techniqueName: string;
  /** Practitioner's own paraphrase — never copied text from the source. */
  description: string;
  /**
   * The fixed causal/theoretical mechanism of the technique — what
   * actually does the work (e.g. "replaces the challenging behaviour's
   * function with a lower-effort communicative alternative"). This is
   * what personalisation must hold fixed: an AI-personalised version may
   * vary surface/theme freely, but if it changes this mechanism, that's a
   * bug, not an acceptable variation. Distinct from `description`, which
   * is a general paraphrase of the technique for browsing.
   */
  mechanism: string;
  strategyCategory: StrategyCategory[];
  /**
   * If true, render separately from the six proactive categories and
   * scale against escalation cycle phase + participant safety/capacity —
   * never applied uniformly.
   */
  isResponsive: boolean;
  /** Disability/diagnostic groups the EVIDENCE covers — what was studied, not who it might help. */
  population: string[];
  evidenceTier: EvidenceTier;
  /**
   * One honest sentence including null/mixed findings — never state a
   * positive finding without a contradicting finding alongside it, if
   * one exists.
   */
  evidenceSummary: string;
  sourceIds: string[];
  prerequisites: string;
  capacityConsiderations: CapacityConsideration[];
  capacityConsiderationsNote: string;
  contraindications: string;
  /** Nullable hard line — never crossed by personalisation or capacity adaptation. */
  safetyBoundary: string | null;
  measurementGuidance: string;
  deliveryFormat: string;
  personalizationAxes: PersonalisationAxis[];
  /** Nullable FK to another StrategyTemplate that supersedes this one's figures. */
  supersededBy: string | null;
  /**
   * Practitioner-authored guidance, not a hard eligibility gate — there is
   * no NDIS-defined age bracket for PBS strategies, so this is never
   * derived from an external standard. Optional and left unset where no
   * real judgement has been made yet; never wired into `isEligible()` as
   * a filter. Surfaced as a visible note on the template detail view —
   * the practitioner still makes the call.
   */
  ageAppropriateness?: {
    minAge?: number;
    maxAge?: number;
    note?: string;
  };
  /**
   * Practitioner/reviewer-authored, free text only — no enum/taxonomy,
   * preserving "flag it, don't design it" for cultural content. When
   * `hasConsiderations` is true, the note is surfaced prominently on the
   * template detail view. Optional and left unset where no real
   * judgement has been made yet.
   */
  culturalSafetyFlag?: {
    hasConsiderations: boolean;
    note?: string;
  };
}

/** StrategyTemplate with its StrategySource records resolved. */
export type StrategyTemplateWithSources = StrategyTemplate & { sources: StrategySource[] };

export type PersonalisationRecordStatus = "draft" | "active" | "discontinued";

export interface PersonalisationRecord {
  id: string;
  strategyTemplateId: string;
  /** Pinned at creation — never silently follows template updates. */
  templateVersionUsed: number;
  /** Local-only, same de-identification posture as the FBA tool. */
  participantRef: string;
  /** Practitioner-reviewed/edited text — what actually goes in the plan/session log. */
  personalisedActivity: string;
  /** Why this technique, for this person. */
  rationale: string;
  authoredBy: string;
  authoredAt: string;
  status: PersonalisationRecordStatus;
}

export type PersonalisationRecordInput = Omit<PersonalisationRecord, "id" | "authoredAt">;
export type PersonalisationRecordUpdate = Partial<
  Omit<PersonalisationRecord, "id" | "strategyTemplateId" | "templateVersionUsed" | "participantRef" | "authoredAt">
>;
