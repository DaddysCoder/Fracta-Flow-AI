import * as StrategyLibraryCore from "@fracta-flow/strategy-library/core";
import type { StrategyTemplate } from "@fracta-flow/strategy-library/core";

// See ParticipantPicker.tsx for why this is a namespace import rather
// than a named import.
const { resolveCurrentTemplate, SEED_TEMPLATES } = StrategyLibraryCore;

/**
 * Hard UI rule from the brief: a superseded figure must never be shown
 * without the newer result shown alongside or instead of it. This banner
 * is the "alongside" half — always rendered together with the original
 * template's own evidence summary, never in place of it.
 */
export function SupersededBanner({ template }: { template: StrategyTemplate }) {
  if (!template.supersededBy) return null;

  const current = resolveCurrentTemplate(template.id, SEED_TEMPLATES);
  if (!current || current.id === template.id) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-medium">This figure has been superseded by newer evidence.</p>
      <p className="mt-1">
        Current: <span className="font-medium">{current.techniqueName}</span> —{" "}
        {current.evidenceSummary}
      </p>
    </div>
  );
}
