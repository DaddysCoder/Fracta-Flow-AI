import { useState, type FormEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import * as ParticipantProfileCore from "@fracta-flow/participant-profile/core";
import type { Participant } from "@fracta-flow/participant-profile/core";
import { db } from "../lib/db";

// Namespace import + destructure rather than named imports: this package
// crosses a CommonJS->ESM boundary that Rollup's static export analysis
// doesn't reliably see through for this build (confirmed present and
// correct at runtime via direct `require()`), so named imports of value
// bindings intermittently fail the production build with "X is not
// exported by core.js". A namespace import defers the lookup to runtime,
// which works. Type-only imports are unaffected (fully erased at compile
// time) and keep using `import type` as normal.
const {
  emptyInterests,
  emptyCommunication,
  emptyCognitive,
  emptyPhysical,
  emptyHealth,
  emptyContext,
} = ParticipantProfileCore;

/**
 * Lightweight local participant picker — NOT the full Participant
 * Profile module's UI (that module ships headless, no UI of its own).
 * This creates real `Participant` records (all fields present, defaults
 * for anything not asked here) so eligibility/personalisation-axis logic
 * downstream behaves exactly as it would against a fully-authored
 * profile.
 *
 * Uses dexie-react-hooks' useLiveQuery, which returns `undefined` while
 * the initial query is still loading AND has no way to distinguish that
 * from "query resolved to nothing" by return value alone — the FBA
 * tool's known bug was treating `undefined` as "no records" and hanging
 * blank on first launch. Guarded against here by checking
 * `participants === undefined` (still loading) before checking
 * `participants.length === 0` (loaded, genuinely empty).
 */
export function ParticipantPicker({
  activeParticipantId,
  onSelect,
}: {
  activeParticipantId: string | null;
  onSelect: (participantId: string) => void;
}) {
  const participants = useLiveQuery(() => db.participants.toArray(), []);
  const [showCreate, setShowCreate] = useState(false);

  if (participants === undefined) {
    return <div className="p-4 text-sm text-slate-500">Loading participants…</div>;
  }

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Active participant
      </h2>

      {participants.length === 0 && !showCreate && (
        <p className="text-sm text-slate-500">No local participants yet.</p>
      )}

      <ul className="space-y-1">
        {participants.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                p.id === activeParticipantId
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Participant {p.id.slice(0, 8)}
              {p.age !== null && <span className="ml-2 opacity-70">age {p.age}</span>}
            </button>
          </li>
        ))}
      </ul>

      {showCreate ? (
        <CreateParticipantForm
          onCreated={(id) => {
            setShowCreate(false);
            onSelect(id);
          }}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-slate-400"
        >
          + New participant
        </button>
      )}
    </div>
  );
}

function CreateParticipantForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [age, setAge] = useState("");
  const [culturalConstraints, setCulturalConstraints] = useState("");
  const [interestsGeneral, setInterestsGeneral] = useState("");
  const [communicationMode, setCommunicationMode] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const participant: Participant = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      age: age.trim() === "" ? null : Number(age),
      culturalConstraints,
      interests: {
        ...emptyInterests(),
        general: interestsGeneral
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      communication: { ...emptyCommunication(), mode: communicationMode },
      cognitive: emptyCognitive(),
      physical: emptyPhysical(),
      health: emptyHealth(),
      context: emptyContext(),
      goals: [],
      behavioursOfConcern: [],
    };

    await db.participants.add(participant);
    onCreated(participant.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
      <div>
        <label className="block text-xs font-medium text-slate-600">Age</label>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Cultural constraints (pre-filter, free text)
        </label>
        <textarea
          value={culturalConstraints}
          onChange={(e) => setCulturalConstraints(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Interests (comma separated)</label>
        <input
          type="text"
          value={interestsGeneral}
          onChange={(e) => setInterestsGeneral(e.target.value)}
          placeholder="trains, dinosaurs, music"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Communication mode</label>
        <input
          type="text"
          value={communicationMode}
          onChange={(e) => setCommunicationMode(e.target.value)}
          placeholder="verbal, AAC, gesture…"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-xs text-slate-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
