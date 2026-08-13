/**
 * Participant Profile data model.
 *
 * This is who-is-this-person data: interests, communication, cognitive,
 * physical, health, and context information that the Strategy Library uses
 * to personalise strategies. It deliberately excludes clinical behaviour
 * data (ABC logs, triangulation, risk flags) — that lives in the FBA tool.
 */

export interface Interests {
  /** Spare time, music, food, animals, shows, colors, places. */
  general: string[];
  /** What they're good at / confident in. */
  strengths: string[];
  /** Often more reliably known than likes. */
  dislikes: string[];
}

export interface Communication {
  /** verbal, AAC, gesture, other — free text, not a closed enum. */
  mode: string;
  /** How they signal "no" or discomfort. */
  indicatesNoOrDiscomfort: string;
}

export interface Cognitive {
  /** Memory, sequencing, abstract vs concrete instruction. */
  capacityNotes: string;
  processingSpeed: string;
  attentionSpan: string;
}

export interface Physical {
  mobility: string;
  stamina: string;
  /** Hearing/vision/tactile sensitivity etc. */
  sensory: string;
}

export interface Health {
  /** All relevant diagnoses — not pre-filtered by category. */
  diagnosis: string[];
  otherNotes: string;
}

export interface ParticipantContext {
  /** e.g. incarcerated, Telehealth-only, supported accommodation, family home. */
  livingSupportSituation: string;
  environmentalConstraints: string;
}

/**
 * Lightweight, non-clinical pointer to a behaviour being worked on.
 * NOT a behaviour record: no triggers, frequency, severity, or setting
 * events. If a field wants that detail, it belongs in the FBA tool.
 */
export interface BehaviourOfConcern {
  id: string;
  name: string;
  /** 1-3 sentences, not a full ABC record. */
  briefDescription: string;
  /** Populated if/when FBA tool integration exists. */
  linkedFbaRecordId?: string | null;
}

export interface Participant {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Eligibility pre-filters — gate what strategies ever surface.
  // NOT personalisation inputs. See getEligibilityFilters().
  age: number | null;
  /** Free text — practices/considerations to respect. Pre-filter, not a personalisation input. */
  culturalConstraints: string;

  interests: Interests;
  communication: Communication;
  cognitive: Cognitive;
  physical: Physical;
  health: Health;
  context: ParticipantContext;

  /** Ties strategy selection to *why*, not just *safely how*. */
  goals: string[];

  behavioursOfConcern: BehaviourOfConcern[];
}

/** Input shape for creating a participant — id/timestamps are assigned by the repository. */
export type ParticipantInput = Omit<Participant, "id" | "createdAt" | "updatedAt" | "behavioursOfConcern"> & {
  behavioursOfConcern?: Array<Omit<BehaviourOfConcern, "id">>;
};

/** Partial update — every field optional, nested objects merged shallowly by the caller. */
export type ParticipantUpdate = Partial<
  Omit<Participant, "id" | "createdAt" | "updatedAt">
>;

export function emptyInterests(): Interests {
  return { general: [], strengths: [], dislikes: [] };
}

export function emptyCommunication(): Communication {
  return { mode: "", indicatesNoOrDiscomfort: "" };
}

export function emptyCognitive(): Cognitive {
  return { capacityNotes: "", processingSpeed: "", attentionSpan: "" };
}

export function emptyPhysical(): Physical {
  return { mobility: "", stamina: "", sensory: "" };
}

export function emptyHealth(): Health {
  return { diagnosis: [], otherNotes: "" };
}

export function emptyContext(): ParticipantContext {
  return { livingSupportSituation: "", environmentalConstraints: "" };
}
