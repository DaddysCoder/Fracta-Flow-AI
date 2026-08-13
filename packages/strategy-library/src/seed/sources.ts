import type { StrategySource } from "../types";

/**
 * Seed StrategySource records. Kept to exactly the three full citations
 * provided with the seed content — no invented DOIs/URLs.
 */
export const SEED_SOURCES: StrategySource[] = [
  {
    id: "crates-spicer-2012",
    title:
      "Developing behavioural training services to meet defined standards within an Australian statewide disability service system and the associated client outcomes",
    authors: "Crates, N., & Spicer, M.",
    publicationYear: 2012,
    urlOrDoi: null,
    publisherType: "academic_paywalled_cite_only",
  },
  {
    id: "hassiotis-2018",
    title:
      "Clinical outcomes of staff training in positive behaviour support to reduce challenging behaviour in adults with intellectual disability: cluster randomised controlled trial",
    authors: "Hassiotis, A., Poppe, M., Strydom, A., et al.",
    publicationYear: 2018,
    urlOrDoi: null,
    publisherType: "academic_paywalled_cite_only",
  },
  {
    id: "paulauskaite-2019",
    title:
      "A systematic review of fidelity measurements in complex interventions for people with intellectual disabilities and behaviours that challenge",
    authors: "Paulauskaite, L., Hassiotis, A., & Ali, A.",
    publicationYear: 2019,
    urlOrDoi: null,
    publisherType: "academic_paywalled_cite_only",
  },
];
