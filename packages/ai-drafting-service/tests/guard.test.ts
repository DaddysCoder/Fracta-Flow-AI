import { describe, it, expect } from "vitest";
import { checkGroundedness } from "../src/guard";
import type { AllowedEvidenceItem } from "../src/evidenceAllowlist";

const evidence: AllowedEvidenceItem[] = [
  {
    id: "ev-1",
    kind: "structured",
    evidenceAuthorityTier: "current_participant_plan",
    strategyType: "visual scheduling",
    behaviourRisk: "elopement near roadways",
    triggerContext: "unstructured transitions",
    staffAction: "offer a visual countdown before transitions",
    staffActionToAvoid: "physical guiding without warning",
  },
];

describe("checkGroundedness", () => {
  it("reports clean when the draft only uses evidence vocabulary and cites a real id", () => {
    const result = checkGroundedness("Offer a visual countdown before transitions.", ["ev-1"], evidence);
    expect(result.clean).toBe(true);
    expect(result.invalidEvidenceIds).toEqual([]);
  });

  it("flags an evidence id the model cited but was never given", () => {
    const result = checkGroundedness("Offer a visual countdown.", ["ev-1", "ev-99"], evidence);
    expect(result.clean).toBe(false);
    expect(result.invalidEvidenceIds).toEqual(["ev-99"]);
  });

  it("flags a proper-noun phrase not present anywhere in the evidence (candidate invented entity)", () => {
    const result = checkGroundedness("Administer Risperidone before transitions.", ["ev-1"], evidence);
    expect(result.clean).toBe(false);
    expect(result.suspiciousTerms).toContain("Administer Risperidone");
  });

  it("flags a standalone number not present anywhere in the evidence (candidate invented dosage/statistic)", () => {
    const result = checkGroundedness("Give 5 doses before transitions.", ["ev-1"], evidence);
    expect(result.clean).toBe(false);
    expect(result.suspiciousTerms).toContain("5");
  });

  it("does not flag a sentence-initial common capitalised word", () => {
    const result = checkGroundedness("The transitions should be offered with a countdown.", ["ev-1"], evidence);
    expect(result.suspiciousTerms).toEqual([]);
  });
});
