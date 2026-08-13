import { useState } from "react";
import * as StrategyLibraryCore from "@fracta-flow/strategy-library/core";
import type { Participant } from "@fracta-flow/participant-profile/core";
import { CATEGORY_LABELS, EVIDENCE_TIER_LABELS } from "../lib/constants";
import { AXIS_LABELS, hasAxisData } from "../lib/personalisationAxes";
import { SupersededBanner } from "./SupersededBanner";
import { PersonalisationWizard } from "./PersonalisationWizard";

// See ParticipantPicker.tsx for why this is a namespace import rather
// than a named import.
const { SEED_SOURCES, SEED_TEMPLATES } = StrategyLibraryCore;

export function TemplateDetail({
  templateId,
  activeParticipant,
  onBack,
}: {
  templateId: string;
  activeParticipant: Participant | null;
  onBack: () => void;
}) {
  const [personalising, setPersonalising] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const template = SEED_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-slate-500">
          ← Back
        </button>
        <p className="mt-2 text-sm text-red-600">Template not found.</p>
      </div>
    );
  }

  const sources = SEED_SOURCES.filter((s) => template.sourceIds.includes(s.id));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to browse
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{template.techniqueName}</h2>
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {EVIDENCE_TIER_LABELS[template.evidenceTier]}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-1">
          {template.isResponsive && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Responsive</span>
          )}
          {template.strategyCategory.map((c) => (
            <span key={c} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
              {CATEGORY_LABELS[c]}
            </span>
          ))}
        </div>

        {template.supersededBy && (
          <div className="mt-3">
            <SupersededBanner template={template} />
          </div>
        )}

        <p className="mt-3 text-sm text-slate-700">{template.description}</p>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mechanism (held fixed by personalisation)" value={template.mechanism} span />
          <Field label="Evidence summary" value={template.evidenceSummary} span />
          {template.population.length > 0 && (
            <Field label="Population studied" value={template.population.join(", ")} />
          )}
          {template.prerequisites && <Field label="Prerequisites" value={template.prerequisites} />}
          {template.contraindications && (
            <Field label="Contraindications" value={template.contraindications} />
          )}
          {template.measurementGuidance && (
            <Field label="Measurement guidance" value={template.measurementGuidance} />
          )}
          {template.deliveryFormat && <Field label="Delivery format" value={template.deliveryFormat} />}
          {template.capacityConsiderations.length > 0 && (
            <Field label="Capacity considerations" value={template.capacityConsiderations.join(", ")} />
          )}
          {template.capacityConsiderationsNote && (
            <Field label="Capacity considerations note" value={template.capacityConsiderationsNote} />
          )}
        </dl>

        {template.safetyBoundary && (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            Safety boundary (never crossed): {template.safetyBoundary}
          </p>
        )}

        {sources.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</h3>
            <ul className="mt-1 space-y-1 text-sm text-slate-600">
              {sources.map((s) => (
                <li key={s.id}>
                  {s.authors} ({s.publicationYear}). {s.title}.
                </li>
              ))}
            </ul>
          </div>
        )}

        {template.personalizationAxes.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Personalisation axes
            </h3>
            <ul className="mt-1 space-y-1 text-sm">
              {template.personalizationAxes.map((axis) => {
                const available = activeParticipant ? hasAxisData(activeParticipant, axis) : false;
                return (
                  <li key={axis} className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        available ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="text-slate-700">{AXIS_LABELS[axis]}</span>
                    <span className="text-xs text-slate-400">
                      {available ? "data available for this participant" : "no data on file"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {!activeParticipant ? (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-500">
          Select or create a participant to personalise this strategy.
        </p>
      ) : personalising ? (
        <PersonalisationWizard
          template={template}
          participant={activeParticipant}
          onCancel={() => setPersonalising(false)}
          onSaved={() => {
            setPersonalising(false);
            setSavedMessage(true);
          }}
        />
      ) : (
        <div className="space-y-2">
          {savedMessage && (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
              Saved. Find it under "My records" to review or export.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setSavedMessage(false);
              setPersonalising(true);
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Personalise for {`participant ${activeParticipant.id.slice(0, 8)}`}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{value}</dd>
    </div>
  );
}
