import { useState } from "react";
import { acknowledgeConsent } from "../lib/consent";

/**
 * Same disclaimer/consent gate posture as the FBA tool: decision support,
 * not diagnostic. Blocks the app until the practitioner explicitly
 * acknowledges it. (The FBA tool's own gate implementation isn't in this
 * repo, so this is a re-implementation matching the described posture,
 * not a direct code reuse.)
 */
export function ConsentGate({ onAcknowledge }: { onAcknowledge: () => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
      <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-slate-900">Before you continue</h1>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          <p>
            The Strategy Library is a <strong>decision support tool, not a diagnostic one</strong>.
            It surfaces evidence-based strategy content for you to review — it never selects or
            generates a strategy on its own.
          </p>
          <p>
            Every personalised activity you save is authored and reviewed by you. You remain
            professionally accountable for the content of your plans, the same way you would for
            any other clinical documentation.
          </p>
          <p>
            No participant-identifying information is sent to any AI system by this tool. Records
            you create are stored locally in this browser only.
          </p>
        </div>
        <label className="mt-5 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          I understand and accept professional responsibility for content I author using this tool.
        </label>
        <button
          type="button"
          disabled={!checked}
          onClick={() => {
            acknowledgeConsent();
            onAcknowledge();
          }}
          className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
