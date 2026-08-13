import { useEffect, useState } from "react";
import type { Participant } from "@fracta-flow/participant-profile/core";
import type { PersonalisationRecordStatus, StrategyTemplate } from "@fracta-flow/strategy-library/core";
import { db } from "../lib/db";
import { buildAxisPayload } from "../lib/axisPayload";
import { requestPersonalisation } from "../lib/api";
import { hasAxisData, AXIS_LABELS } from "../lib/personalisationAxes";
import { loadDraft, saveDraft, clearDraft } from "../lib/personalisationDraft";
import { formatForPlan, formatForSessionLog } from "../lib/reformat";

type ErrorState = { type: "refusal" } | { type: "failure" };

interface GenerationInfo {
  keptFixedStatement: string;
  citations: string[];
}

/**
 * Steps 2 and 3 from the Personalization Architecture brief:
 *  - Step 2 (capacity adaptation note) is practitioner judgement,
 *    recorded as a note — never sent to the model.
 *  - Step 3 (the bounded generation call) fires only for the strategy's
 *    declared axes, using only the matching de-identified profile field
 *    values, and its result is always shown for review/edit before
 *    saving — never auto-saved.
 */
export function PersonalisationWizard({
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
  const draftKeyDeps = [participant.id, template.id];
  const initialDraft = loadDraft(participant.id, template.id);

  const [capacityAdaptationNote, setCapacityAdaptationNote] = useState(initialDraft.capacityAdaptationNote);
  const [personalisedActivity, setPersonalisedActivity] = useState(initialDraft.personalisedActivity);
  const [rationale, setRationale] = useState(initialDraft.rationale);
  const [authoredBy, setAuthoredBy] = useState(initialDraft.authoredBy);
  const [status, setStatus] = useState<PersonalisationRecordStatus>("draft");

  const [generating, setGenerating] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [saving, setSaving] = useState(false);

  // Persist on every change so a failed/refused call, or a reload
  // mid-flow, never forces re-entry.
  useEffect(() => {
    saveDraft(participant.id, template.id, { capacityAdaptationNote, personalisedActivity, rationale, authoredBy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacityAdaptationNote, personalisedActivity, rationale, authoredBy, ...draftKeyDeps]);

  const declaredAxes = template.personalizationAxes;
  const availableAxes = declaredAxes.filter((axis) => hasAxisData(participant, axis));
  const canGenerate = availableAxes.length > 0;

  async function handleGenerate() {
    setGenerating(true);
    setErrorState(null);
    try {
      const axisPayload = buildAxisPayload(template, participant);
      const result = await requestPersonalisation(template.id, axisPayload);

      switch (result.outcome) {
        case "success":
          setPersonalisedActivity(result.personalisedActivity);
          setGenerationInfo({ keptFixedStatement: result.keptFixedStatement, citations: result.citations });
          break;
        case "refusal":
          setErrorState({ type: "refusal" });
          break;
        case "network_error":
        case "api_error":
          setErrorState({ type: "failure" });
          break;
      }
    } finally {
      setGenerating(false);
    }
  }

  function applyFormat(format: "plan" | "session-log") {
    const citations = generationInfo?.citations ?? [];
    const input = {
      techniqueName: template.techniqueName,
      personalisedActivity,
      keptFixedStatement: generationInfo?.keptFixedStatement,
      citations,
    };
    setPersonalisedActivity(format === "plan" ? formatForPlan(input) : formatForSessionLog(input));
  }

  async function handleSave(e: React.FormEvent) {
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
    clearDraft(participant.id, template.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-medium text-slate-900">
        Personalise "{template.techniqueName}" for participant {participant.id.slice(0, 8)}
      </h3>

      {/* Step 2: capacity adaptation — practitioner judgement, not an AI call. */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Capacity adaptation note <span className="font-normal text-slate-400">(optional, your own note — not sent to any AI call)</span>
        </label>
        <textarea
          value={capacityAdaptationNote}
          onChange={(e) => setCapacityAdaptationNote(e.target.value)}
          rows={2}
          placeholder="Any capacity-specific adaptation this participant needs…"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        {template.capacityConsiderations.length > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            Capacity considerations on file: {template.capacityConsiderations.join(", ")}
          </p>
        )}
      </div>

      {/* Step 3: bounded generation call, only for declared axes. */}
      {declaredAxes.length > 0 ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            Declared personalisation axes for this strategy: {declaredAxes.map((a) => AXIS_LABELS[a]).join(", ")}.
            {!canGenerate && " No data on file for this participant on any of them — write the activity manually below."}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Personalising…" : "Personalise with AI"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          This strategy has no declared personalisation axes — write the personalised activity manually below.
        </p>
      )}

      {errorState?.type === "refusal" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This entry wasn't able to be personalised automatically — this can happen even with entirely
          legitimate clinical detail (trauma history, cultural background, aversions). Nothing you entered
          was lost. Write it manually or try rephrasing.
        </p>
      )}
      {errorState?.type === "failure" && (
        <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Something went wrong on our end. Your answers are saved — try again.
        </p>
      )}

      {/* Alongside the output: fixed mechanism + citation, always. */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fixed mechanism</p>
        <p className="mt-0.5 text-slate-700">{template.mechanism}</p>
        {generationInfo && (
          <>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Kept fixed</p>
            <p className="mt-0.5 text-slate-700">{generationInfo.keptFixedStatement}</p>
          </>
        )}
        {(generationInfo?.citations.length ?? 0) > 0 && (
          <>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Citation</p>
            <ul className="mt-0.5 space-y-0.5 text-slate-700">
              {generationInfo!.citations.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {template.safetyBoundary && (
        <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          Safety boundary (never crossed): {template.safetyBoundary}
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Personalised activity <span className="font-normal text-slate-400">(reviewed/edited by you before saving)</span>
            </label>
            {generationInfo && (
              <div className="flex gap-1">
                <button type="button" onClick={() => applyFormat("plan")} className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
                  Plan format
                </button>
                <button type="button" onClick={() => applyFormat("session-log")} className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">
                  Session-log format
                </button>
              </div>
            )}
          </div>
          <textarea
            required
            value={personalisedActivity}
            onChange={(e) => setPersonalisedActivity(e.target.value)}
            rows={5}
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
    </div>
  );
}
