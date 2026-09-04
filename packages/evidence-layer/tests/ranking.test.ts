import { describe, expect, it } from "vitest";
import { rankEvidence } from "../src/ranking";
import type { StructuredKnowledgeRecord } from "../src/types";

function record(overrides: Partial<StructuredKnowledgeRecord> & Pick<StructuredKnowledgeRecord, "id" | "evidenceAuthorityTier">): StructuredKnowledgeRecord {
  return {
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2024-01-01",
    current: true,
    supersededBy: null,
    participantRef: "participant-1",
    sourceDocumentId: `doc-${overrides.id}`,
    strategyType: "generic strategy",
    behaviourRisk: "",
    triggerContext: "",
    earlyWarningSign: "",
    staffAction: "",
    staffActionToAvoid: "",
    ...overrides,
  };
}

describe("rankEvidence", () => {
  it("a weakly-matching tier-1 record outranks a strongly-matching tier-4 record", () => {
    const tier1 = record({
      id: "tier1-plan",
      evidenceAuthorityTier: "current_participant_plan",
      staffAction: "give a seatbelt reminder before the vehicle moves",
    });
    const tier4 = record({
      id: "tier4-assessment",
      evidenceAuthorityTier: "assessment_evidence",
      staffAction: "seatbelt reminder seatbelt reminder seatbelt reminder observed during transport assessment",
      strategyType: "seatbelt reminder",
    });

    const hits = rankEvidence("seatbelt reminder", "daily_support", [tier1, tier4]);

    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].record.id).toBe("tier1-plan");
    // Confirms this is a hard gate, not a soft score comparison: tier4's raw
    // BM25/phrase score is far higher, yet it never appears because tier1
    // already produced a qualifying hit.
    expect(hits.some((hit) => hit.record.id === "tier4-assessment")).toBe(false);
  });

  it("falls through to the next tier when the top tier has no qualifying evidence", () => {
    const tier4 = record({
      id: "tier4-only",
      evidenceAuthorityTier: "assessment_evidence",
      staffAction: "seatbelt reminder during transport assessment",
      strategyType: "seatbelt reminder",
    });

    const hits = rankEvidence("seatbelt reminder", "daily_support", [tier4]);
    expect(hits[0]?.record.id).toBe("tier4-only");
  });

  it("excludes non-approved records regardless of tier", () => {
    const pending = record({
      id: "pending",
      evidenceAuthorityTier: "current_participant_plan",
      approvalStatus: "needs_review",
      staffAction: "seatbelt reminder before transport",
    });
    const hits = rankEvidence("seatbelt reminder", "daily_support", [pending]);
    expect(hits).toEqual([]);
  });

  it("applies a stronger workflow multiplier when the query's category is weighted for that workflow", () => {
    const evidence = record({
      id: "incident-record",
      evidenceAuthorityTier: "current_participant_plan",
      strategyType: "incident response",
      staffAction: "follow the incident response plan and debrief after the incident",
    });

    const incidentHits = rankEvidence("incident response plan", "incident", [evidence]);
    const dailyHits = rankEvidence("incident response plan", "daily_support", [evidence]);

    expect(incidentHits[0].workflowMultiplier).toBeGreaterThan(dailyHits[0].workflowMultiplier);
    expect(incidentHits[0].finalScore).toBeGreaterThan(dailyHits[0].finalScore);
    // The base relevance score itself (before the workflow multiplier) must
    // be identical — only the multiplier differs between workflows.
    expect(incidentHits[0].baseScore).toBe(dailyHits[0].baseScore);
  });
});
