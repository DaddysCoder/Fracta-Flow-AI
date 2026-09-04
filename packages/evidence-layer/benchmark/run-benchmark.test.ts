import { describe, expect, it } from "vitest";
import { rankEvidence } from "../src/ranking";
import { QUESTIONS, RECORDS } from "./fixtures";

/**
 * evidence-layer's starter benchmark, implemented as a vitest suite so it
 * runs with `npm test` like everything else in the monorepo rather than
 * needing a bespoke harness. Gates mirror the spirit of rag-work's
 * benchmark/v2 (a fixed pass/fail bar on retrieval quality) but for the
 * dimensions specific to this package: does the top hit come from the
 * correct authority tier, does supersession ever let stale content win over
 * current guidance, and does workflow context actually change ranking the
 * way it's supposed to.
 */
describe("evidence-layer starter benchmark", () => {
  it("tier-correctness: the top hit for every question comes from the expected record and tier", () => {
    const results = QUESTIONS.map((question) => {
      const hits = rankEvidence(question.query, question.workflowContext, RECORDS);
      return { question, top: hits[0] };
    });

    const passed = results.filter((r) => r.top?.record.id === r.question.expectedRecordId);
    const rate = passed.length / results.length;

    if (rate < 1) {
      // eslint-disable-next-line no-console
      console.log(
        "tier-correctness misses:",
        results.filter((r) => r.top?.record.id !== r.question.expectedRecordId).map((r) => ({
          id: r.question.id,
          query: r.question.query,
          expected: r.question.expectedRecordId,
          got: r.top?.record.id ?? null,
        })),
      );
    }

    expect(rate).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.top?.record.evidenceAuthorityTier).toBe(r.question.expectedTier);
    }
  });

  it("supersession-correctness: superseded content never outranks current guidance for the same trigger", () => {
    const hits = rankEvidence("sensory break fire alarm", "daily_support", RECORDS);
    expect(hits[0]?.record.id).toBe("sensory-break-current");
    expect(hits.some((hit) => hit.record.id === "sensory-break-superseded" && hits.indexOf(hit) === 0)).toBe(false);
  });

  it("supersession-correctness: an explicit history query still allows the superseded record to surface", () => {
    const supersededOnly = RECORDS.filter((r) => r.id !== "sensory-break-current");
    const hits = rankEvidence("what was the previous version of the sensory break strategy", "daily_support", supersededOnly);
    expect(hits[0]?.record.id).toBe("sensory-break-superseded");
  });

  it("workflow-sensitivity: the same query re-ranks with a stronger multiplier under the matching workflow", () => {
    const query = "incident report debrief";
    const incident = rankEvidence(query, "incident", RECORDS);
    const daily = rankEvidence(query, "daily_support", RECORDS);

    expect(incident[0]?.record.id).toBe("incident-debrief-procedure");
    expect(daily[0]?.record.id).toBe("incident-debrief-procedure");
    expect(incident[0]!.workflowMultiplier).toBeGreaterThan(daily[0]!.workflowMultiplier);
  });
});
