import type { StrategyTemplate } from "../types";

/**
 * Seed StrategyTemplate content: 15 entries extracted (paraphrase-only,
 * no quoting, no merging of conflicting sources without flagging it, no
 * invented detail) from the three sources in ./sources.ts.
 *
 * KNOWN CONTENT GAP (per the brief, not a bug): these entries are
 * re-tagged against the v2 `strategyCategory` scheme as a first content
 * task, but `capacityConsiderations`, `personalizationAxes`,
 * `prerequisites`, `contraindications`, `safetyBoundary`,
 * `measurementGuidance`, and `deliveryFormat` were not supplied with the
 * seed data and are left empty/blank rather than invented — authoring
 * those is separate follow-up content work, not a build task. `population`
 * is set only where the source citation itself names the population
 * studied (Hassiotis 2018 explicitly studied "adults with intellectual
 * disability"; Paulauskaite 2019 explicitly reviewed studies of "people
 * with intellectual disabilities"; Crates & Spicer 2012 does not name a
 * population in the citation, so it is left unset).
 *
 * Zero seed entries exist yet for Regulating, Community, or Health and
 * Wellbeing — also a known gap, not a build defect.
 *
 * `mechanism` is a later addition (Personalization Architecture brief):
 * the fixed causal/theoretical mechanism personalisation must hold
 * constant, distinct from `description`. Backfilled here as an honest
 * one-sentence paraphrase grounded in each entry's existing description/
 * evidence summary — not sourced from new citations.
 *
 * `personalizationAxes` is populated for a representative subset
 * (visual-scheduling, functional-communication-training, skills-teaching,
 * coping-and-tolerance-skills-training) so the personalisation flow has
 * real content to exercise; the rest are left `[]` pending the same
 * content follow-up already noted above. `safetyBoundary` is populated
 * for the two reactive entries, directly supported by their existing
 * "non-punitive"/"reactive" framing — not invented clinical detail.
 */
export const SEED_TEMPLATES: StrategyTemplate[] = [
  {
    id: "positive-behaviour-support",
    version: 1,
    techniqueName: "Positive Behaviour Support (package-level)",
    description:
      "A package-level PBS approach, reviewed at the fidelity level by Paulauskaite et al. (2019), which cites a 43% reduction in challenging behaviour from Hassiotis et al.'s 2009 pilot (n=63). That pilot's figure has since been superseded by a much larger, better-powered trial — see supersededBy.",
    mechanism:
      "Package-level: replaces multiple maintaining conditions for challenging behaviour with proactive supports and taught alternatives, delivered through staff training.",
    strategyCategory: [],
    isResponsive: false,
    population: ["intellectual_disability"],
    evidenceTier: "systematic_review",
    evidenceSummary:
      "A 43% reduction was reported in a small (n=63) 2009 pilot as cited secondarily by Paulauskaite et al. (2019); this figure must never be shown without the null result from the later, adequately powered Hassiotis et al. (2018) cluster RCT (see supersededBy) shown alongside or instead of it.",
    sourceIds: ["paulauskaite-2019"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: "differential-reinforcement",
  },
  {
    id: "ecological-strategies",
    version: 1,
    techniqueName: "Ecological Strategies",
    description:
      "Adjustments to the person's physical and routine environment, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Reduces the environmental demand or mismatch that triggers challenging behaviour by adjusting the physical space or routine itself, rather than asking the person to change.",
    strategyCategory: ["environmental"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "visual-scheduling",
    version: 1,
    techniqueName: "Visual Scheduling",
    description:
      "Use of visual schedules to increase predictability of routine, reported as a specific example within the ecological strategies component of the same PBS training service evaluation.",
    mechanism:
      "Reduces uncertainty about what happens next by externalising the routine as a visual sequence, lowering anxiety-driven behaviour tied to unpredictability.",
    strategyCategory: ["environmental"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as an example within a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: ["interests"],
    supersededBy: null,
  },
  {
    id: "functional-communication-training",
    version: 1,
    techniqueName: "Functional Communication Training",
    description:
      "Teaching a person a new, more effective way to communicate a need that challenging behaviour currently serves, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Replaces the challenging behaviour's communicative function with a taught, lower-effort alternative that achieves the same outcome.",
    strategyCategory: ["communication"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: ["communication_style"],
    supersededBy: null,
  },
  {
    id: "functionally-equivalent-skills-training",
    version: 1,
    techniqueName: "Functionally Equivalent Skills Training",
    description:
      "Teaching a skill that achieves the same outcome as the challenging behaviour, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Teaches a skill that produces the same functional outcome as the challenging behaviour, so the behaviour is no longer the most efficient way to get that outcome.",
    strategyCategory: ["learning"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "coping-and-tolerance-skills-training",
    version: 1,
    techniqueName: "Coping and Tolerance Skills Training",
    description:
      "Teaching skills for coping with and tolerating distressing situations, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Builds the person's own capacity to tolerate distressing situations, reducing reliance on challenging behaviour as an escape or avoidance response.",
    strategyCategory: ["learning"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: ["interests"],
    supersededBy: null,
  },
  {
    id: "antecedent-control-strategies",
    version: 1,
    techniqueName: "Antecedent Control Strategies",
    description:
      "Modifying conditions that precede challenging behaviour to reduce its likelihood, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Removes or modifies the conditions that reliably precede challenging behaviour, reducing its likelihood before it starts.",
    strategyCategory: ["environmental"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "time-based-reinforcement",
    version: 1,
    techniqueName: "Time-Based Reinforcement",
    description:
      "Delivering reinforcement on a fixed time schedule independent of behaviour, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Delivers reinforcement on a fixed schedule independent of behaviour, reducing the motivating operation that drives behaviour aimed at obtaining that reinforcement.",
    strategyCategory: ["environmental"],
    isResponsive: false,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012); the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "differential-reinforcement",
    version: 1,
    techniqueName: "Differential Reinforcement",
    description:
      "Reinforcing a desired alternative behaviour while withholding reinforcement for the challenging one. This is a MERGED entry: two sources describe the same underlying technique with conflicting findings, so both are stated honestly rather than picking a side.",
    mechanism:
      "Reinforces a specific alternative behaviour while withholding reinforcement for the challenging one, shifting which behaviour gets reinforced without changing what is reinforcing.",
    strategyCategory: ["learning"],
    isResponsive: false,
    population: ["intellectual_disability"],
    evidenceTier: "mixed_package_level",
    evidenceSummary:
      "Crates & Spicer (2012, n=32, no control group) reported a 49.6% reduction in occurrence and 30.8% reduction in episodic severity at 3 months as part of a package; Hassiotis et al.'s (2018) larger, better-powered cluster RCT (n=246) found no significant effect at 12 months, with weak implementation fidelity. Neither study isolates this technique's individual contribution from the rest of its package — both findings are reported rather than one being preferred.",
    sourceIds: ["crates-spicer-2012", "hassiotis-2018"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "nonaversive-reactive-strategies",
    version: 1,
    techniqueName: "Nonaversive Reactive Strategies",
    description:
      "Non-punitive responses used once challenging behaviour is already occurring, reported as one package-level component within a broader PBS training service evaluation.",
    mechanism:
      "Responds to challenging behaviour once it is occurring in a way that de-escalates without punishment, avoiding reinforcement of the behaviour while keeping the interaction non-punitive.",
    strategyCategory: [],
    isResponsive: true,
    population: [],
    evidenceTier: "single_study",
    evidenceSummary:
      "Reported as part of a single-study, package-level evaluation (Crates & Spicer, 2012) with a 30.8% reduction in episodic severity; the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["crates-spicer-2012"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: "Never use physical restraint, seclusion, or aversive/punitive procedures.",
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "noncontingent-reinforcement",
    version: 1,
    techniqueName: "Noncontingent Reinforcement",
    description:
      "Delivering reinforcement independent of the person's behaviour, reported as one package-level component within a larger cluster RCT of PBS staff training.",
    mechanism:
      "Delivers reinforcement on a schedule unrelated to behaviour, reducing the motivation to engage in challenging behaviour to obtain it.",
    strategyCategory: [],
    isResponsive: false,
    population: ["intellectual_disability"],
    evidenceTier: "rct",
    evidenceSummary:
      "No significant effect was found at 12 months in a cluster RCT (Hassiotis et al., 2018, n=246); the individual contribution of this component was not isolated from the rest of the package, and implementation fidelity was weak.",
    sourceIds: ["hassiotis-2018"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "skills-teaching",
    version: 1,
    techniqueName: "Skills Teaching",
    description:
      "Direct teaching of replacement or coping skills, reported as one package-level component within a larger cluster RCT of PBS staff training.",
    mechanism:
      "Directly teaches a replacement or coping skill so the person has another way to meet the need currently met by challenging behaviour.",
    strategyCategory: ["learning"],
    isResponsive: false,
    population: ["intellectual_disability"],
    evidenceTier: "rct",
    evidenceSummary:
      "No significant effect was found at 12 months in a cluster RCT (Hassiotis et al., 2018, n=246); the individual contribution of this component was not isolated from the rest of the package, and implementation fidelity was weak.",
    sourceIds: ["hassiotis-2018"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: ["interests", "communication_style"],
    supersededBy: null,
  },
  {
    id: "primary-prevention-strategies",
    version: 1,
    techniqueName: "Primary Prevention Strategies",
    description:
      "Upstream, whole-environment prevention strategies applied before any warning signs appear, reported as one package-level component within a larger cluster RCT of PBS staff training. Primary/Secondary Prevention is a timing framing, not a category in the v2 scheme — this entry needs re-tagging into whichever of the six actual categories fits, not carried forward as its own category.",
    mechanism:
      "Adjusts the whole environment upstream of any behaviour, reducing baseline risk factors before warning signs appear.",
    strategyCategory: [],
    isResponsive: false,
    population: ["intellectual_disability"],
    evidenceTier: "rct",
    evidenceSummary:
      "No significant effect was found at 12 months in a cluster RCT (Hassiotis et al., 2018, n=246); implementation was weak, with only 33 of 108 reports containing all required elements, and the individual contribution of this component was not isolated from the rest of the package.",
    sourceIds: ["hassiotis-2018"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "secondary-prevention-strategies",
    version: 1,
    techniqueName: "Secondary Prevention Strategies",
    description:
      "Prevention strategies applied once early warning signs are detected, reported as one package-level component within a larger cluster RCT of PBS staff training. Primary/Secondary Prevention is a timing framing, not a category in the v2 scheme — this entry needs re-tagging into whichever of the six actual categories fits, not carried forward as its own category.",
    mechanism:
      "Intervenes once early warning signs are detected, aiming to prevent escalation to peak behaviour.",
    strategyCategory: [],
    isResponsive: false,
    population: ["intellectual_disability"],
    evidenceTier: "rct",
    evidenceSummary:
      "No significant effect was found at 12 months in a cluster RCT (Hassiotis et al., 2018, n=246); the individual contribution of this component was not isolated from the rest of the package, and implementation fidelity was weak.",
    sourceIds: ["hassiotis-2018"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: null,
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
  {
    id: "reactive-strategies",
    version: 1,
    techniqueName: "Reactive Strategies",
    description:
      "Responses used once challenging behaviour is already occurring, reported as one package-level component within a larger cluster RCT of PBS staff training.",
    mechanism:
      "Responds to challenging behaviour once it is occurring, aiming to keep the person and others safe and de-escalate without reinforcing the behaviour.",
    strategyCategory: [],
    isResponsive: true,
    population: ["intellectual_disability"],
    evidenceTier: "rct",
    evidenceSummary:
      "No significant effect was found at 12 months in a cluster RCT (Hassiotis et al., 2018, n=246); the individual contribution of this component was not isolated from the rest of the package, and implementation fidelity was weak.",
    sourceIds: ["hassiotis-2018"],
    prerequisites: "",
    capacityConsiderations: [],
    capacityConsiderationsNote: "Not yet re-tagged — pending content task.",
    contraindications: "",
    safetyBoundary: "Never use physical restraint, seclusion, or aversive/punitive procedures.",
    measurementGuidance: "",
    deliveryFormat: "",
    personalizationAxes: [],
    supersededBy: null,
  },
];
