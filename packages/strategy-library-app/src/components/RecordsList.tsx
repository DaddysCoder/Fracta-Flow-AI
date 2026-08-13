import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as StrategyLibraryCore from "@fracta-flow/strategy-library/core";
import type { PersonalisationRecord } from "@fracta-flow/strategy-library/core";
import type { Participant } from "@fracta-flow/participant-profile/core";
import { db } from "../lib/db";
import { ExportView } from "./ExportView";

// See ParticipantPicker.tsx for why this is a namespace import rather
// than a named import.
const { SEED_TEMPLATES } = StrategyLibraryCore;

/**
 * As with ParticipantPicker, `undefined` from useLiveQuery means "still
 * loading", not "no records" — checked explicitly to avoid the FBA
 * tool's known blank-hang bug on first launch.
 */
export function RecordsList({ activeParticipant }: { activeParticipant: Participant | null }) {
  const [exporting, setExporting] = useState<PersonalisationRecord | null>(null);

  const records = useLiveQuery(
    () =>
      activeParticipant
        ? db.personalisationRecords.where("participantRef").equals(activeParticipant.id).toArray()
        : Promise.resolve<PersonalisationRecord[]>([]),
    [activeParticipant?.id]
  );

  if (!activeParticipant) {
    return <p className="text-sm text-brand-muted">Select a participant to see their records.</p>;
  }

  if (records === undefined) {
    return <p className="text-sm text-brand-muted">Loading records…</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base text-brand-ink">
        Records for participant {activeParticipant.id.slice(0, 8)}
      </h2>

      {records.length === 0 && (
        <p className="text-sm text-brand-muted">
          No personalisation records yet. Browse strategies and personalise one for this
          participant.
        </p>
      )}

      <ul className="space-y-3">
        {records.map((r) => {
          const template = SEED_TEMPLATES.find((t) => t.id === r.strategyTemplateId);
          return (
            <li key={r.id} className="rounded-brand border border-brand-border bg-brand-paper p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-brand-ink">
                    {template?.techniqueName ?? r.strategyTemplateId}
                  </h3>
                  <p className="mt-1 text-sm text-brand-muted">{r.personalisedActivity}</p>
                  <p className="mt-2 text-xs text-brand-muted">
                    {r.status} · authored by {r.authoredBy || "—"} on{" "}
                    {new Date(r.authoredAt).toLocaleDateString()}
                    {template && template.version !== r.templateVersionUsed && (
                      <span className="ml-2 font-medium text-brand-ink">
                        · template updated since (v{r.templateVersionUsed} → v{template.version})
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExporting(r)}
                  className="whitespace-nowrap rounded-brand border border-brand-border px-2.5 py-1 text-xs font-medium text-brand-ink hover:border-brand-ink"
                >
                  Export
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {exporting && <ExportView record={exporting} onClose={() => setExporting(null)} />}
    </div>
  );
}
