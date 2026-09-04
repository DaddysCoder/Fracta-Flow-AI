import { useMemo, useState } from "react";
import * as EvidenceLayerCore from "@fracta-flow/evidence-layer";
import type { EvidenceHit, WorkflowContext } from "@fracta-flow/evidence-layer";
import type { Participant } from "@fracta-flow/participant-profile/core";
import {
  EVIDENCE_AUTHORITY_TIER_LABELS,
  INTENT_CATEGORY_LABELS,
  WORKFLOW_CONTEXT_LABELS,
  WORKFLOW_CONTEXT_ORDER,
} from "../lib/constants";
import { queryEvidence } from "../lib/evidenceQuery";

// See ParticipantPicker.tsx for why this is a namespace import rather
// than a named import.
const { isStructuredKnowledgeRecord } = EvidenceLayerCore;

/**
 * Evidence Search: a practitioner enters a query, picks the FIELD workflow
 * they're currently in, and sees ranked evidence back from the real
 * `rankEvidence` engine — not a mock of it (see `../lib/evidenceQuery.ts`
 * and `../lib/evidenceSeed.ts` for what's standing in for a live evidence
 * backend today).
 *
 * Every result shows its authority tier, matched intent categories, and
 * workflow multiplier alongside the score — HANDOFF.md calls this out as a
 * safety-critical explainability requirement, so none of it is collapsed
 * behind a single opaque "relevance" number. `activeParticipant` scopes
 * which candidates are ever queried (see `queryEvidence`) — never just
 * which results are displayed.
 */
export function EvidenceSearch({ activeParticipant }: { activeParticipant: Participant | null }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [workflowContext, setWorkflowContext] = useState<WorkflowContext>("daily_support");

  const hits = useMemo<EvidenceHit[]>(
    () => queryEvidence(submittedQuery, workflowContext, activeParticipant?.id ?? null),
    [submittedQuery, workflowContext, activeParticipant?.id]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base text-brand-ink">Evidence search</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Search approved PBS evidence, ranked by authority tier and the current workflow — decision
          support, not diagnostic.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQuery(query);
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-xs font-medium text-brand-muted" htmlFor="evidence-query">
            Query
          </label>
          <input
            id="evidence-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. transport seatbelt, incident debrief, restrictive practice"
            className="mt-1 w-full rounded border border-brand-border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted" htmlFor="evidence-workflow">
            Workflow context
          </label>
          <select
            id="evidence-workflow"
            value={workflowContext}
            onChange={(e) => setWorkflowContext(e.target.value as WorkflowContext)}
            className="mt-1 w-full rounded border border-brand-border bg-brand-paper px-3 py-2 text-sm text-brand-ink"
          >
            {WORKFLOW_CONTEXT_ORDER.map((wc) => (
              <option key={wc} value={wc}>
                {WORKFLOW_CONTEXT_LABELS[wc]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!query.trim()}
          className="rounded-brand bg-brand-purple px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Search evidence
        </button>
      </form>

      {!activeParticipant && (
        <p className="rounded-brand border border-brand-border bg-brand-paper p-4 text-sm text-brand-muted">
          No participant selected — results are limited to org-wide evidence (procedures, policy,
          assessment material). Select a participant to also include their current plan.
        </p>
      )}

      {submittedQuery && (
        <div className="space-y-3">
          {hits.length === 0 && (
            <p className="text-sm text-brand-muted">No approved evidence matched this query.</p>
          )}
          {hits.map((hit) => (
            <EvidenceHitCard key={recordId(hit)} hit={hit} />
          ))}
        </div>
      )}
    </div>
  );
}

function recordId(hit: EvidenceHit): string {
  return isStructuredKnowledgeRecord(hit.record) ? hit.record.id : hit.record.chunk.id;
}

function EvidenceHitCard({ hit }: { hit: EvidenceHit }) {
  const { record } = hit;
  const structured = isStructuredKnowledgeRecord(record);

  return (
    <div className="rounded-brand border border-brand-border bg-brand-paper p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-brand-ink px-2 py-0.5 text-xs font-medium text-white">
          {EVIDENCE_AUTHORITY_TIER_LABELS[record.evidenceAuthorityTier]}
        </span>
        {!record.current && (
          <span className="rounded-full bg-brand-surface px-2 py-0.5 text-xs text-brand-muted">Superseded</span>
        )}
        {record.participantRef && (
          <span className="rounded-full border border-brand-border px-2 py-0.5 text-xs text-brand-muted">
            Participant {record.participantRef.slice(0, 8)}
          </span>
        )}
        {!record.participantRef && (
          <span className="rounded-full border border-brand-border px-2 py-0.5 text-xs text-brand-muted">
            Org-wide
          </span>
        )}
      </div>

      <h3 className="mt-2 font-medium text-brand-ink">
        {structured ? record.strategyType : record.document.name}
      </h3>

      <p className="mt-1 text-sm text-brand-muted">
        {structured ? record.staffAction : excerptFor(record.chunk.text)}
      </p>

      {structured && record.staffActionToAvoid && (
        <p className="mt-1 text-sm text-brand-muted">
          <span className="font-medium text-brand-ink">Avoid:</span> {record.staffActionToAvoid}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-brand-border pt-3 text-xs text-brand-muted sm:grid-cols-4">
        <div>
          <dt className="font-semibold uppercase tracking-wide">Base score</dt>
          <dd className="mt-0.5 text-brand-ink">{hit.baseScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Workflow ×</dt>
          <dd className="mt-0.5 text-brand-ink">{hit.workflowMultiplier.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Final score</dt>
          <dd className="mt-0.5 text-brand-ink">{hit.finalScore.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide">Matched categories</dt>
          <dd className="mt-0.5 text-brand-ink">
            {hit.matchedCategories.length > 0
              ? hit.matchedCategories.map((c) => INTENT_CATEGORY_LABELS[c]).join(", ")
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function excerptFor(text: string, maxLength = 220): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
