import type { EvidenceRecord, StructuredKnowledgeRecord } from "./types";

/** Same phrasing heuristic as retrieval-core's ranking.ts `versionIntent().asksHistory`. */
const ASKS_HISTORY = /\b(what did|what was|previous version|old version|historical|former version|prior version|superseded version)\b/i;

export function asksForHistory(query: string): boolean {
  return ASKS_HISTORY.test(query);
}

/**
 * Follows the `supersededBy` chain to the current record, generalising
 * strategy-library's `resolveCurrentTemplate` (src/supersede.ts) to any
 * EvidenceRecord. Guards against cycles the same way — a broken/circular
 * chain resolves to whatever was last reached rather than looping forever.
 */
export function resolveCurrentRecord(id: string, records: EvidenceRecord[] | Map<string, EvidenceRecord>): EvidenceRecord | null {
  const byId = records instanceof Map ? records : new Map(records.map((r) => [r.id, r]));
  const seen = new Set<string>();
  let current = byId.get(id) ?? null;
  while (current?.supersededBy && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.supersededBy);
    if (!next) break;
    current = next;
  }
  return current;
}

export interface CurrentKey {
  participantRef: string | null;
  strategyType: string;
  triggerContext: string;
}

function keyOf(record: StructuredKnowledgeRecord): string {
  return `${record.participantRef ?? "org-wide"}::${record.strategyType}::${record.triggerContext}`;
}

/**
 * Write-time invariant: at most one `current: true` record per
 * (participantRef, strategyType, triggerContext). Call this before
 * persisting a write that sets `current: true` — it throws rather than
 * silently allowing two contradictory "current" instructions to coexist.
 */
export function assertNoConflictingCurrent(existing: StructuredKnowledgeRecord[], incoming: StructuredKnowledgeRecord): void {
  if (!incoming.current) return;
  const incomingKey = keyOf(incoming);
  const conflict = existing.find((record) => record.id !== incoming.id && record.current && keyOf(record) === incomingKey);
  if (conflict) {
    throw new Error(
      `Conflicting current record: "${conflict.id}" is already current for participantRef=${incoming.participantRef ?? "org-wide"}, ` +
        `strategyType=${incoming.strategyType}, triggerContext=${incoming.triggerContext}. Mark it superseded before writing a new current record.`,
    );
  }
}

export interface EvidenceLookupResult {
  record: EvidenceRecord | null;
  /** true when the only match found was superseded and no current equivalent exists — callers must not present this silently as a live answer. */
  isStaleFallback: boolean;
}

/**
 * Resolves which version of a record to show: the current one, unless the
 * query explicitly asks for history, in which case the originally-matched
 * (possibly superseded) record is returned as-is. If nothing current
 * exists at all, the superseded record is still returned, but flagged
 * `isStaleFallback: true` so the caller can surface a "no current guidance
 * found" warning instead of answering silently from stale content.
 */
export function resolveForQuery(query: string, matched: EvidenceRecord, all: EvidenceRecord[]): EvidenceLookupResult {
  if (matched.current || asksForHistory(query)) {
    return { record: matched, isStaleFallback: false };
  }
  const current = resolveCurrentRecord(matched.id, all);
  if (current && current.current) return { record: current, isStaleFallback: false };
  return { record: current ?? matched, isStaleFallback: true };
}
