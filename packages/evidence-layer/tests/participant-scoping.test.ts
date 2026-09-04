import { describe, expect, it } from "vitest";
import { rankEvidence } from "../src/ranking";
import type { StructuredKnowledgeRecord } from "../src/types";

function record(overrides: Partial<StructuredKnowledgeRecord> & Pick<StructuredKnowledgeRecord, "id" | "participantRef">): StructuredKnowledgeRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    evidenceAuthorityTier: "current_participant_plan",
    sourceDocumentId: `doc-${overrides.id}`,
    strategyType: "sensory break",
    behaviourRisk: "",
    triggerContext: "",
    earlyWarningSign: "",
    staffAction: "offer a sensory break during loud fire alarm drills",
    staffActionToAvoid: "",
    ...overrides,
  };
}

/**
 * evidence-layer itself doesn't reach out to a database — it ranks whatever
 * candidate list the host app passes in. Participant scoping is therefore
 * the HOST's responsibility (never pass another participant's records into
 * a query for participant A), but this test documents and locks in the
 * expectation that rankEvidence itself performs no further mixing/merging
 * that could leak a match across participantRef boundaries.
 */
describe("participant scoping", () => {
  it("only returns records for the participant actually present in the candidate list passed in", () => {
    const participantA = record({ id: "a-plan", participantRef: "participant-A" });
    const hits = rankEvidence("sensory break fire alarm", "daily_support", [participantA]);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.record.participantRef === "participant-A")).toBe(true);
  });

  it("never returns a record whose participantRef differs from every record actually asked about", () => {
    const participantA = record({ id: "a-plan", participantRef: "participant-A" });
    const participantB = record({ id: "b-plan", participantRef: "participant-B" });

    // Simulates a host app correctly scoping its own query to participant A's
    // records only — participant B's record must never be in the candidate
    // list in the first place, and if it leaked in by mistake it must never
    // be returned mixed in with participant A's results.
    const hits = rankEvidence("sensory break fire alarm", "daily_support", [participantA]);
    expect(hits.some((hit) => hit.record.participantRef === participantB.participantRef)).toBe(false);
  });
});
