import { useState, type FormEvent } from "react";
import type { Participant } from "@fracta-flow/participant-profile/core";
import type {
  PersonalisationRecordStatus,
  StrategyTemplate,
} from "@fracta-flow/strategy-library/core";
import { db } from "../lib/db";

/**
 * The practitioner writes personalisedActivity/rationale themselves —
 * this form never pre-fills or suggests that content. The system
 * assembles (see ExportView); the practitioner authors.
 */
export function PersonalisationForm({
  template,
  participant,
  onSaved,
  onCancel,
}: {
  template: StrategyTemplate;
  participant: Participant;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [personalisedActivity, setPersonalisedActivity] = useState("");
  const [rationale, setRationale] = useState("");
  const [authoredBy, setAuthoredBy] = useState("");
  const [status, setStatus] = useState<PersonalisationRecordStatus>("draft");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await db.personalisationRecords.add({
      id: crypto.randomUUID(),
      strategyTemplateId: template.id,
      templateVersionUsed: template.version,
      participantRef: participant.id,
      personalisedActivity,
      rationale,
      authoredBy,
      authoredAt: new Date().toISOString(),
      status,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-medium text-slate-900">
        Personalise "{template.techniqueName}" for participant {participant.id.slice(0, 8)}
      </h3>

      {template.safetyBoundary && (
        <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          Safety boundary (never crossed): {template.safetyBoundary}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Personalised activity</label>
        <textarea
          required
          value={personalisedActivity}
          onChange={(e) => setPersonalisedActivity(e.target.value)}
          rows={4}
          placeholder="What actually goes in the plan/session log…"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Rationale</label>
        <textarea
          required
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={3}
          placeholder="Why this technique, for this person…"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700">Authored by</label>
          <input
            required
            type="text"
            value={authoredBy}
            onChange={(e) => setAuthoredBy(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PersonalisationRecordStatus)}
            className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Save personalisation record
        </button>
        <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-sm text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
