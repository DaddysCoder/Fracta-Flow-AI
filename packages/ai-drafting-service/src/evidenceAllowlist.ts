import type { EvidenceAuthorityTier } from "@fracta-flow/evidence-layer";
import { EVIDENCE_AUTHORITY_TIERS } from "@fracta-flow/evidence-layer";

/**
 * The allowlisted shape the model prompt is ever built from. This is the
 * enforcement point for the input contract: the type itself has no
 * `participantRef`, no `sourceDocumentId`, no name/DOB/anything
 * identity-shaped — so even a caller that (accidentally or otherwise)
 * serialises a full `EvidenceHit`/`EvidenceRecord` into the request body
 * cannot get identity into the prompt, because `extractAllowedEvidence`
 * below only ever *reads* these specific fields off the untrusted input
 * and nothing else is ever assigned onto this type.
 *
 * `id` is the evidence record's own id (or chunk id) — used only for
 * citation ("EVIDENCE_USED: ev-3") and for the groundedness guard; it is
 * never a participant identifier (participantRef is never read at all).
 */
export interface AllowedEvidenceItem {
  id: string;
  kind: "structured" | "chunk";
  evidenceAuthorityTier: EvidenceAuthorityTier;
  /** Present when kind === "structured". */
  strategyType?: string;
  behaviourRisk?: string;
  triggerContext?: string;
  earlyWarningSign?: string;
  staffAction?: string;
  staffActionToAvoid?: string;
  /** Present when kind === "chunk". */
  excerpt?: string;
  documentName?: string;
  documentType?: string;
}

const AUTHORITY_TIER_SET = new Set<string>(EVIDENCE_AUTHORITY_TIERS);

function isAuthorityTier(value: unknown): value is EvidenceAuthorityTier {
  return typeof value === "string" && AUTHORITY_TIER_SET.has(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Extracts one allowlisted item from one raw, untrusted `EvidenceHit`-like
 * object (as it arrives over HTTP, already JSON-parsed). Returns null for
 * anything that doesn't clear the gates below — the caller is expected to
 * have produced this input via `rankEvidence`, but this function trusts
 * none of that and re-checks the governance invariants itself:
 *
 * - `approvalStatus` must literally be "approved" (defense in depth —
 *   `rankEvidence` already filters this, but a caller bug or a hand-built
 *   request body must not be able to smuggle a non-current or
 *   needs_review/rejected/quarantined record through).
 * - `current` must be true — never draft from a superseded record.
 * - For a chunk record, the source document's own PII/secret/prompt-
 *   injection inspection flags must all be clear; a flagged document is
 *   dropped rather than partially trusted.
 * - `participantRef`, `sourceDocumentId`, `version`, `effectiveDate`,
 *   `supersededBy` are never read here at all — not filtered out, simply
 *   never referenced, so there is no field to forget to strip.
 */
export function extractAllowedEvidenceItem(rawHit: unknown): AllowedEvidenceItem | null {
  if (typeof rawHit !== "object" || rawHit === null) return null;
  const hit = rawHit as Record<string, unknown>;
  const record = hit.record;
  if (typeof record !== "object" || record === null) return null;
  const r = record as Record<string, unknown>;

  if (r.approvalStatus !== "approved") return null;
  if (r.current !== true) return null;
  if (!isNonEmptyString(r.id)) return null;
  if (!isAuthorityTier(r.evidenceAuthorityTier)) return null;

  const id = r.id;
  const evidenceAuthorityTier = r.evidenceAuthorityTier;

  // StructuredKnowledgeRecord: identified by having a strategyType field.
  if (typeof r.strategyType === "string") {
    if (
      !isNonEmptyString(r.strategyType) ||
      !isNonEmptyString(r.behaviourRisk) ||
      !isNonEmptyString(r.triggerContext) ||
      !isNonEmptyString(r.staffAction)
    ) {
      return null;
    }
    return {
      id,
      kind: "structured",
      evidenceAuthorityTier,
      strategyType: r.strategyType,
      behaviourRisk: r.behaviourRisk as string,
      triggerContext: r.triggerContext as string,
      earlyWarningSign: isNonEmptyString(r.earlyWarningSign) ? (r.earlyWarningSign as string) : "",
      staffAction: r.staffAction as string,
      staffActionToAvoid: isNonEmptyString(r.staffActionToAvoid) ? (r.staffActionToAvoid as string) : "",
    };
  }

  // EvidenceChunkRecord: identified by having a chunk + document.
  if (typeof r.chunk === "object" && r.chunk !== null && typeof r.document === "object" && r.document !== null) {
    const chunk = r.chunk as Record<string, unknown>;
    const document = r.document as Record<string, unknown>;
    if (!isNonEmptyString(chunk.text)) return null;

    const inspection = document.inspection as Record<string, unknown> | undefined;
    if (
      inspection &&
      (inspection.possiblePersonalInfo === true ||
        inspection.possibleSecrets === true ||
        inspection.possiblePromptInjection === true)
    ) {
      return null;
    }

    return {
      id,
      kind: "chunk",
      evidenceAuthorityTier,
      excerpt: chunk.text as string,
      documentName: isNonEmptyString(document.name) ? (document.name as string) : undefined,
      documentType: isNonEmptyString(document.documentType) ? (document.documentType as string) : undefined,
    };
  }

  return null;
}

/**
 * Extracts and allowlists a whole `rankEvidence(...)`-shaped array. Any
 * item that fails a governance check is silently dropped, never partially
 * trusted. `maxItems` bounds prompt size (and blast radius of a single
 * request) — extra items beyond it are dropped, not truncated mid-field.
 */
export function extractAllowedEvidence(rawHits: unknown, maxItems = 12): AllowedEvidenceItem[] {
  if (!Array.isArray(rawHits)) return [];
  const items: AllowedEvidenceItem[] = [];
  for (const rawHit of rawHits) {
    const item = extractAllowedEvidenceItem(rawHit);
    if (item) items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
}
