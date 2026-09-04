import * as EvidenceLayerCore from "@fracta-flow/evidence-layer";
import type { EvidenceHit, WorkflowContext } from "@fracta-flow/evidence-layer";
import { buildEvidenceCandidates } from "./evidenceSeed";

// Namespace import + destructure, matching the same reasoning documented in
// ParticipantPicker.tsx: @fracta-flow/evidence-layer crosses a CommonJS ->
// ESM boundary that Rollup's static export analysis doesn't reliably see
// through in the production build (named imports intermittently fail with
// "X is not exported by dist/index.js"), while a namespace import defers
// the lookup to runtime, where it resolves correctly.
const { rankEvidence } = EvidenceLayerCore;

/**
 * Runs an evidence query for the given participant context.
 *
 * Participant scoping happens BEFORE `rankEvidence` is ever called:
 * `buildEvidenceCandidates` only returns org-wide evidence plus the active
 * participant's own records, so a query made while viewing participant A
 * can never be handed participant B's evidence to rank in the first place.
 * `rankEvidence` itself additionally drops anything not `approvalStatus:
 * "approved"` — see evidence-layer's `ranking.ts`.
 */
export function queryEvidence(
  query: string,
  workflowContext: WorkflowContext,
  activeParticipantId: string | null
): EvidenceHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const candidates = buildEvidenceCandidates(activeParticipantId);
  return rankEvidence(trimmed, workflowContext, candidates);
}
