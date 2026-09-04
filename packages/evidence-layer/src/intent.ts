import { baseTokens } from "@fracta-flow/retrieval-core";
import type { IntentCategory } from "./types";

/**
 * Deterministic keyword/phrase lookup, same philosophy as rag-work's
 * `queryConceptGroups` in text-search.ts (a hand-curated table, not a
 * model) — every classification decision is explainable by pointing at the
 * trigger phrase that matched. Extend this table as real query logs surface
 * gaps; never replace it with an LLM call, since ranking must stay
 * auditable end to end.
 */
const INTENT_TRIGGERS: Record<IntentCategory, string[]> = {
  proactive_strategy: ["proactive", "prevent", "prevention", "before it happens", "reduce likelihood", "environmental support"],
  reactive_strategy: ["reactive", "when this happens", "respond to", "de-escalate", "de-escalation"],
  incident_response: ["incident", "after an incident", "debrief", "report the incident", "critical incident"],
  transport_safety: ["transport", "vehicle", "car ride", "bus", "seatbelt", "travelling"],
  restrictive_practice: ["restrictive practice", "restraint", "seclusion", "chemical restraint", "mechanical restraint", "authorisation"],
  communication: ["communication", "communicate", "aac", "how to talk", "language to use"],
  risk: ["risk", "hazard", "danger", "safety concern"],
  consent: ["consent", "guardian", "substitute decision", "authorised representative"],
  assessment_evidence: ["assessment", "fba", "functional behaviour assessment", "evaluation", "observation data"],
  staff_instruction: ["staff instruction", "what staff should do", "shift note", "handover"],
  medication: ["medication", "prn", "dose", "medicine", "chemist"],
};

const TRIGGER_TOKENS: Record<IntentCategory, string[][]> = Object.fromEntries(
  Object.entries(INTENT_TRIGGERS).map(([category, phrases]) => [category, phrases.map((phrase) => baseTokens(phrase))])
) as Record<IntentCategory, string[][]>;

function containsSubsequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) return true;
  }
  return false;
}

/**
 * Returns every intent category whose trigger phrases match the query.
 * A query may match zero, one, or several categories (e.g. "transport
 * incident" matches both transport_safety and incident_response) — callers
 * use the full set, not just the top match, so workflow weighting can act
 * on all of them.
 */
export function classifyIntent(query: string): IntentCategory[] {
  const tokens = baseTokens(query);
  const matched: IntentCategory[] = [];
  for (const [category, phraseTokenSets] of Object.entries(TRIGGER_TOKENS) as [IntentCategory, string[][]][]) {
    if (phraseTokenSets.some((phraseTokens) => containsSubsequence(tokens, phraseTokens))) {
      matched.push(category);
    }
  }
  return matched;
}
