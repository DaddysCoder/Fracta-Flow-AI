import type { Participant } from "./types";

/**
 * Eligibility pre-filters: gate which strategies are ever allowed to
 * surface for this participant, the same way age-appropriateness would.
 * These are NOT inputs to any personalisation step — they must never be
 * passed to an AI content-generation call as "vary the content by this".
 * Use them only for hard include/exclude filtering upstream of selection.
 */
export interface EligibilityFilters {
  age: number | null;
  culturalConstraints: string;
}

/**
 * Personalisation context: safe to hand to a strategy-personalisation
 * step (rules engine or AI) to shape *how* a strategy is delivered.
 * Deliberately excludes culturalConstraints and behavioursOfConcern
 * clinical detail — culture is filtered upstream (see EligibilityFilters),
 * and behaviours are a relevance pointer, not personalisation fodder.
 */
export interface PersonalisationContext {
  interests: Participant["interests"];
  communication: Participant["communication"];
  cognitive: Participant["cognitive"];
  physical: Participant["physical"];
  health: Participant["health"];
  context: Participant["context"];
  goals: string[];
}

/**
 * Thin relevance pointer for the Strategy Library to show "this is
 * relevant to what's being worked on". Not for clinical use.
 */
export interface BehaviourRelevanceTag {
  id: string;
  name: string;
  briefDescription: string;
  linkedFbaRecordId?: string | null;
}

export function getEligibilityFilters(participant: Participant): EligibilityFilters {
  return {
    age: participant.age,
    culturalConstraints: participant.culturalConstraints,
  };
}

export function getPersonalisationContext(participant: Participant): PersonalisationContext {
  return {
    interests: participant.interests,
    communication: participant.communication,
    cognitive: participant.cognitive,
    physical: participant.physical,
    health: participant.health,
    context: participant.context,
    goals: participant.goals,
  };
}

export function getBehaviourRelevanceTags(participant: Participant): BehaviourRelevanceTag[] {
  return participant.behavioursOfConcern.map((b) => ({
    id: b.id,
    name: b.name,
    briefDescription: b.briefDescription,
    linkedFbaRecordId: b.linkedFbaRecordId,
  }));
}
