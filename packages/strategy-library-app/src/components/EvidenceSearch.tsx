import { useMemo, useState } from "react";
import * as EvidenceLayerCore from "@fracta-flow/evidence-layer/core";
import type { EvidenceHit, WorkflowContext } from "@fracta-flow/evidence-layer/core";
import type { Participant } from "@fracta-flow/participant-profile/core";
import {
  EVIDENCE_AUTHORITY_TIER_LABELS,
  INTENT_CATEGORY_LABELS,
  WORKFLOW_CONTEXTS,
  WORKFLOW_CONTEXT_LABELS,
} from "../lib/constants";
import { SEED_EVIDENCE_RECORDS } from "../lib/evidenceSeed";

// Namespace import + destructure rather than named imports — same Rollup
// CJS-interop issue documented in ParticipantPicker.tsx and this app's
// vite.config.ts: named imports of value bindings from these
// workspace packages intermittently fail the production build.
const { rankEvidence } = EvidenceLayerCore;

/**
 * The FIELD evidence layer's first live UI surface: runs a query through
 * evidence-layer's deterministic, tier-gated `rankEvidence` against the
 * bundled seed evidence (see evidenceSeed.ts — placeholder content, same
 * status as strategy-library's SEED_TEMPLATES until a real evidence
 * ingestion/authoring pipeline exists). This is deliberately a search
 * screen, not a browse screen: evidence ranking is query- and
 * workflow-context-dependent in a way strategy browsing isn't.
 *
 * No purple here either — like StrategyBrowser, this is a lookup view with
 * no single primary action.
 */
export function EvidenceSearch({ activeParticipant }: { activeParticipant: Participant | null }) {
  const [query, setQuery] = useState("");
  const [workflowContext, setWorkflowContext] = useState<WorkflowContext>("daily_support");

  const scopedRecords = useMemo(
    () =>
      SEED_EVIDENCE_RECORDS.filter(
        (record) => record.participantRef === null || record.participantRef === activeParticipant?.id
      ),
    [activeParticipant]
  );

  const hits: EvidenceHit[] = useMemo(() => {
    if (!query.trim()) return [];
    return rankEvidence(query, workflowContext, scopedRecords);
  }, [query, workflowContext, scopedRecords]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">Evidence search</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Deterministic, tier-gated retrieval — never a model call. A current participant plan always
          outranks a lower-tier match, regardless of keyword score.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. seatbelt reminder, sensory break, incident debrief…"
          className="min-w-64 flex-1 rounded-brand border border-brand-border px-3 py-2 text-sm"
        />
        <select
          value={workflowContext}
          onChange={(e) => setWorkflowContext(e.target.value as WorkflowContext)}
          className="rounded-brand border border-brand-border px-3 py-2 text-sm text-brand-ink"
        >
          {WORKFLOW_CONTEXTS.map((context) => (
            <option key={context} value={context}>
              {WORKFLOW_CONTEXT_LABELS[context]}
            </option>
          ))}
        </select>
      </div>

      {!activeParticipant && (
        <p className="rounded-brand border border-brand-border bg-brand-paper p-4 text-sm text-brand-muted">
          Select a participant to also search their participant-specific evidence, not just
          organisation-wide procedures.
        </p>
      )}

      {query.trim() && hits.length === 0 && (
        <p className="rounded-brand border border-brand-border bg-brand-paper p-4 text-sm text-brand-muted">
          No approved evidence found for that query in the current workflow context.
        </p>
      )}

      <div className="grid gap-4">
        {hits.map((hit) => (
          <EvidenceHitCard key={hit.record.id} hit={hit} />
        ))}
      </div>
    </div>
  );
}

function EvidenceHitCard({ hit }: { hit: EvidenceHit }) {
  const record = hit.record;
  const isStructured = "strategyType" in record;
  const isStale = record.evidenceAuthorityTier === "historical_superseded";

  return (
    <div className="rounded-brand border border-brand-border bg-brand-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-brand-ink">{isStructured ? record.strategyType : record.sourceDocumentId}</h3>
        <span className="whitespace-nowrap rounded-full bg-brand-surface px-2 py-0.5 text-xs text-brand-muted">
          {EVIDENCE_AUTHORITY_TIER_LABELS[record.evidenceAuthorityTier]}
        </span>
      </div>

      {hit.matchedCategories.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {hit.matchedCategories.map((category) => (
            <span key={category} className="rounded bg-brand-surface px-1.5 py-0.5 text-xs text-brand-ink">
              {INTENT_CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
      )}

      {isStale && (
        <div className="mt-2 rounded-brand border-l-4 border-brand-ink bg-brand-surface p-3 text-sm text-brand-ink">
          <p className="font-medium">No current guidance found</p>
          <p className="mt-1 text-brand-muted">
            This is historical/superseded material shown only because no current equivalent exists —
            verify before acting on it.
          </p>
        </div>
      )}

      {isStructured && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {record.triggerContext && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Trigger context</dt>
              <dd className="text-brand-ink">{record.triggerContext}</dd>
            </div>
          )}
          {record.earlyWarningSign && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Early warning sign</dt>
              <dd className="text-brand-ink">{record.earlyWarningSign}</dd>
            </div>
          )}
          {record.staffAction && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Staff action</dt>
              <dd className="text-brand-ink">{record.staffAction}</dd>
            </div>
          )}
          {record.staffActionToAvoid && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Staff action to avoid</dt>
              <dd className="text-brand-ink">{record.staffActionToAvoid}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-3 text-xs text-brand-muted">
        {record.participantRef ? "Participant-specific" : "Organisation-wide"} · v{record.version} · effective{" "}
        {record.effectiveDate}
      </p>
    </div>
  );
}
