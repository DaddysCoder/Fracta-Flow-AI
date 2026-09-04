import { describe, expect, it } from "vitest";
import { assertNoConflictingCurrent, resolveCurrentRecord, resolveForQuery } from "../src/supersession";
import type { StructuredKnowledgeRecord } from "../src/types";

function record(overrides: Partial<StructuredKnowledgeRecord> & Pick<StructuredKnowledgeRecord, "id">): StructuredKnowledgeRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    evidenceAuthorityTier: "current_participant_plan",
    participantRef: "participant-1",
    sourceDocumentId: `doc-${overrides.id}`,
    strategyType: "sensory break",
    behaviourRisk: "",
    triggerContext: "loud environments",
    earlyWarningSign: "",
    staffAction: "",
    staffActionToAvoid: "",
    ...overrides,
  };
}

describe("assertNoConflictingCurrent", () => {
  it("rejects a second current record for the same participant/strategyType/triggerContext", () => {
    const existing = [record({ id: "v1", current: true })];
    const incoming = record({ id: "v2", current: true });
    expect(() => assertNoConflictingCurrent(existing, incoming)).toThrow(/Conflicting current record/);
  });

  it("allows a non-current write even if another record is current for the same tuple", () => {
    const existing = [record({ id: "v1", current: true })];
    const incoming = record({ id: "v2", current: false });
    expect(() => assertNoConflictingCurrent(existing, incoming)).not.toThrow();
  });

  it("allows a current write once the prior current record has been superseded (no longer current)", () => {
    const existing = [record({ id: "v1", current: false, supersededBy: "v2" })];
    const incoming = record({ id: "v2", current: true });
    expect(() => assertNoConflictingCurrent(existing, incoming)).not.toThrow();
  });

  it("does not conflict across different participants", () => {
    const existing = [record({ id: "v1", current: true, participantRef: "participant-1" })];
    const incoming = record({ id: "v2", current: true, participantRef: "participant-2" });
    expect(() => assertNoConflictingCurrent(existing, incoming)).not.toThrow();
  });
});

describe("resolveCurrentRecord", () => {
  it("walks a multi-hop supersession chain to the current record", () => {
    const v1 = record({ id: "v1", current: false, supersededBy: "v2" });
    const v2 = record({ id: "v2", current: false, supersededBy: "v3" });
    const v3 = record({ id: "v3", current: true, supersededBy: null });
    expect(resolveCurrentRecord("v1", [v1, v2, v3])?.id).toBe("v3");
  });

  it("does not infinite-loop on a circular chain", () => {
    const a = record({ id: "a", current: false, supersededBy: "b" });
    const b = record({ id: "b", current: false, supersededBy: "a" });
    expect(() => resolveCurrentRecord("a", [a, b])).not.toThrow();
  });
});

describe("resolveForQuery", () => {
  it("returns the current record silently when one exists", () => {
    const old = record({ id: "old", current: false, supersededBy: "new" });
    const current = record({ id: "new", current: true });
    const result = resolveForQuery("what's the current strategy", old, [old, current]);
    expect(result.record?.id).toBe("new");
    expect(result.isStaleFallback).toBe(false);
  });

  it("returns the superseded record without a stale flag when the query explicitly asks for history", () => {
    const old = record({ id: "old", current: false, supersededBy: "new" });
    const current = record({ id: "new", current: true });
    const result = resolveForQuery("what was the previous version of this strategy", old, [old, current]);
    expect(result.record?.id).toBe("old");
    expect(result.isStaleFallback).toBe(false);
  });

  it("flags a stale fallback when no current equivalent exists", () => {
    const onlyHistorical = record({ id: "only", current: false, supersededBy: null });
    const result = resolveForQuery("what's the current strategy", onlyHistorical, [onlyHistorical]);
    expect(result.record?.id).toBe("only");
    expect(result.isStaleFallback).toBe(true);
  });
});
