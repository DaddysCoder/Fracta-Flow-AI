import { describe, expect, it } from "vitest";
import { queryEvidence } from "./evidenceQuery";
import { DEMO_SCOPED_PARTICIPANT_IDS } from "./evidenceSeed";

const [participantOne, participantTwo] = DEMO_SCOPED_PARTICIPANT_IDS;

describe("queryEvidence", () => {
  it("returns nothing for an empty query", () => {
    expect(queryEvidence("", "daily_support", null)).toEqual([]);
    expect(queryEvidence("   ", "daily_support", null)).toEqual([]);
  });

  it("returns ranked, approved org-wide evidence for a query with no participant selected", () => {
    const hits = queryEvidence("transport seatbelt", "transport", null);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.record.approvalStatus === "approved")).toBe(true);
    expect(hits.every((hit) => hit.record.participantRef === null)).toBe(true);
  });

  it("never returns a quarantined/needs-review record", () => {
    const hits = queryEvidence("medication PRN", "daily_support", null);
    expect(hits.every((hit) => hit.record.approvalStatus === "approved")).toBe(true);
  });

  it("surfaces tier, matched categories and workflow multiplier on every hit — the explainability requirement", () => {
    const hits = queryEvidence("transport seatbelt", "transport", null);
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.record.evidenceAuthorityTier).toBeTruthy();
      expect(Array.isArray(hit.matchedCategories)).toBe(true);
      expect(typeof hit.workflowMultiplier).toBe("number");
      expect(typeof hit.baseScore).toBe("number");
      expect(typeof hit.finalScore).toBe("number");
    }
  });

  it("the transport workflow context weights transport_safety matches above an unweighted context", () => {
    const inTransportWorkflow = queryEvidence("transport seatbelt", "transport", null);
    const inDailySupportWorkflow = queryEvidence("transport seatbelt", "daily_support", null);
    expect(inTransportWorkflow[0].workflowMultiplier).toBeGreaterThan(inDailySupportWorkflow[0].workflowMultiplier);
  });

  describe("participant scoping", () => {
    it("includes a participant's own current-plan evidence only when browsing in their context", () => {
      const hits = queryEvidence("fire alarm sensory break", "daily_support", participantOne);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((hit) => hit.record.participantRef === participantOne)).toBe(true);
    });

    it("never surfaces another participant's scoped evidence, even when the query matches it", () => {
      // The same query that matches participant one's fire-alarm plan must
      // not surface it while browsing in participant two's context — their
      // candidate list never contains it in the first place.
      const hits = queryEvidence("fire alarm sensory break", "daily_support", participantTwo);
      expect(hits.every((hit) => hit.record.participantRef !== participantOne)).toBe(true);
    });

    it("never surfaces participant-scoped evidence at all with no participant selected", () => {
      const hits = queryEvidence("fire alarm sensory break", "daily_support", null);
      expect(hits.every((hit) => hit.record.participantRef === null)).toBe(true);
    });
  });
});
