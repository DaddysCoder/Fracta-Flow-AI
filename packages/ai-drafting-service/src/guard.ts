import type { AllowedEvidenceItem } from "./evidenceAllowlist";

export interface GroundednessCheck {
  /** IDs the model cited in EVIDENCE_USED that don't correspond to any evidence item it was actually given — a strong signal something is wrong (hallucinated citation, or a format the parser mis-split). */
  invalidEvidenceIds: string[];
  /** Capitalised terms/numbers in the draft that don't appear anywhere in the evidence text — candidate invented entities/figures for a human to check. Heuristic, see caveats below. */
  suspiciousTerms: string[];
  /** True only when both checks above found nothing. Never block a response on this alone — see caveats. */
  clean: boolean;
}

/**
 * A best-effort guard against the model adding clinical claims not
 * present in the input evidence — not a guarantee. Two checks:
 *
 * 1. Structural: every id in the model's own EVIDENCE_USED line must be
 *    one of the evidence ids it was actually given. This is reliable —
 *    it's just a set membership check — and catches a model citing
 *    evidence that doesn't exist.
 *
 * 2. Heuristic: proper-noun-shaped phrases and standalone numbers in the
 *    drafted text that don't appear anywhere in the evidence vocabulary.
 *    This is NOT a clinical-claims detector — it's a lightweight lexical
 *    overlap check. Known gaps (documented, not silently assumed away):
 *      - It cannot catch an invented claim built entirely from words that
 *        already appear in the evidence (e.g. flipping "monitor" into
 *        "restrain", or reversing a "never"/"always"), since no new
 *        *token* was introduced.
 *      - It cannot catch a fabricated lowercase clinical term (e.g. an
 *        invented drug or diagnosis name in lowercase, or one that
 *        happens to share a token with the evidence).
 *      - Common capitalised words (sentence-initial words, "PBS", weekday
 *        names) will produce false positives; callers should surface
 *        `suspiciousTerms` for practitioner review, never auto-reject on
 *        it alone.
 *    A real no-invented-claims guarantee needs an NLI/entailment check
 *    (e.g. a second, cheap model call asking "is every claim in DRAFT
 *    entailed by EVIDENCE?") — that is the documented gap for this pass;
 *    see the AI-drafting-service handoff notes.
 */
export function checkGroundedness(
  draftText: string,
  evidenceUsedIds: string[],
  evidence: AllowedEvidenceItem[]
): GroundednessCheck {
  const knownIds = new Set(evidence.map((item) => item.id));
  const invalidEvidenceIds = evidenceUsedIds.filter((id) => !knownIds.has(id));

  const evidenceVocabulary = buildVocabulary(evidence);
  const suspiciousTerms = findSuspiciousTerms(draftText, evidenceVocabulary);

  return {
    invalidEvidenceIds,
    suspiciousTerms,
    clean: invalidEvidenceIds.length === 0 && suspiciousTerms.length === 0,
  };
}

function buildVocabulary(evidence: AllowedEvidenceItem[]): Set<string> {
  const vocabulary = new Set<string>();
  for (const item of evidence) {
    const fields = [
      item.strategyType,
      item.behaviourRisk,
      item.triggerContext,
      item.earlyWarningSign,
      item.staffAction,
      item.staffActionToAvoid,
      item.excerpt,
      item.documentName,
      item.documentType,
    ];
    for (const field of fields) {
      if (!field) continue;
      for (const token of tokenize(field)) vocabulary.add(token);
    }
  }
  return vocabulary;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 0);
}

/** Common capitalised words that are not evidence-shaped and would otherwise flood suspiciousTerms with noise. */
const COMMON_CAPITALISED_WORDS = new Set([
  "the",
  "a",
  "an",
  "i",
  "pbs",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

function findSuspiciousTerms(draftText: string, evidenceVocabulary: Set<string>): string[] {
  const suspicious = new Set<string>();

  // Multi-word capitalised phrases (candidate proper nouns) not present
  // anywhere in the evidence vocabulary.
  const properNounPhrases = draftText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) ?? [];
  for (const phrase of properNounPhrases) {
    const words = phrase.split(/\s+/);
    if (words.length === 1 && COMMON_CAPITALISED_WORDS.has(words[0].toLowerCase())) continue;
    const grounded = words.every((word) => evidenceVocabulary.has(word.toLowerCase()));
    if (!grounded) suspicious.add(phrase);
  }

  // Standalone numbers (candidate invented dosages/frequencies/statistics)
  // not present anywhere in the evidence text.
  const numbers = draftText.match(/\b\d+(\.\d+)?\b/g) ?? [];
  for (const number of numbers) {
    if (!evidenceVocabulary.has(number)) suspicious.add(number);
  }

  return Array.from(suspicious);
}
