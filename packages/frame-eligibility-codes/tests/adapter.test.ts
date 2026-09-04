import { describe, expect, it } from "vitest";
import { classifyIntent } from "@fracta-flow/evidence-layer";
import type { EvidenceRecord } from "@fracta-flow/evidence-layer";
import { decodeEligibilityCode } from "../src/codec";
import { buildEligibilityAwareQuery, DIAGNOSIS_EXPECTED_CATEGORIES, restrictToOrgWideEvidence, toEligibilityFilters } from "../src/adapter";

const DECODED = decodeEligibilityCode("1AXs")!; // autism, 13-17, standard

describe("toEligibilityFilters", () => {
  it("maps the age band to its midpoint and leaves cultural constraints unset", () => {
    expect(toEligibilityFilters(DECODED)).toEqual({ age: 15, culturalConstraints: "" });
  });

  it("produces an EligibilityFilters-shaped value for every band", () => {
    for (const [code, expectedAge] of [
      ["1AVs", 3],
      ["1AWs", 9],
      ["1AXs", 15],
      ["1AYs", 21],
      ["1AZs", 44],
      ["1AUs", 70],
    ] as const) {
      const decoded = decodeEligibilityCode(code)!;
      expect(toEligibilityFilters(decoded).age).toBe(expectedAge);
    }
  });
});

describe("buildEligibilityAwareQuery + classifyIntent", () => {
  it("appending the diagnosis hint makes the query classify into the expected intent categories, for every diagnosis category", () => {
    for (const [diagnosisCode, diagnosis] of [
      ["1AXs", "autism"],
      ["1BXs", "intellectual_disability"],
      ["1CXs", "psychosocial_disability"],
      ["1DXs", "acquired_brain_injury"],
      ["1EXs", "other_developmental"],
    ] as const) {
      const decoded = decodeEligibilityCode(diagnosisCode)!;
      expect(decoded.diagnosisCategory).toBe(diagnosis);

      const query = buildEligibilityAwareQuery("what strategies help", decoded);
      const categories = classifyIntent(query);
      for (const expected of DIAGNOSIS_EXPECTED_CATEGORIES[diagnosis]) {
        expect(categories).toContain(expected);
      }
    }
  });
});

function orgWideRecord(id: string): EvidenceRecord {
  return {
    id,
    approvalStatus: "approved",
    version: 1,
    effectiveDate: "2026-01-01",
    current: true,
    supersededBy: null,
    evidenceAuthorityTier: "org_procedure_current",
    participantRef: null,
    sourceDocumentId: `doc-${id}`,
    strategyType: "example",
    behaviourRisk: "example",
    triggerContext: "example",
    earlyWarningSign: "example",
    staffAction: "example",
    staffActionToAvoid: "example",
  };
}

function participantSpecificRecord(id: string): EvidenceRecord {
  return { ...orgWideRecord(id), evidenceAuthorityTier: "current_participant_plan", participantRef: "p-123" };
}

describe("restrictToOrgWideEvidence", () => {
  it("keeps only participantRef === null records", () => {
    const candidates = [orgWideRecord("a"), participantSpecificRecord("b"), orgWideRecord("c")];
    const result = restrictToOrgWideEvidence(candidates);
    expect(result.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns an empty array when every candidate is participant-specific", () => {
    expect(restrictToOrgWideEvidence([participantSpecificRecord("b")])).toEqual([]);
  });
});
