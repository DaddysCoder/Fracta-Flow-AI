import { describe, it, expect } from "vitest";
import { buildDraftingPrompt, parseDraftResponse } from "../src/promptBuilder";
import type { AllowedEvidenceItem } from "../src/evidenceAllowlist";

const structuredItem: AllowedEvidenceItem = {
  id: "ev-1",
  kind: "structured",
  evidenceAuthorityTier: "current_participant_plan",
  strategyType: "visual scheduling",
  behaviourRisk: "elopement near roadways",
  triggerContext: "unstructured transitions",
  earlyWarningSign: "pacing",
  staffAction: "offer a visual countdown before transitions",
  staffActionToAvoid: "physical guiding without warning",
};

const chunkItem: AllowedEvidenceItem = {
  id: "ev-2",
  kind: "chunk",
  evidenceAuthorityTier: "org_procedure_current",
  excerpt: "seatbelt reminder before the vehicle moves",
  documentName: "Transport Safety Procedure",
  documentType: "org_procedure",
};

describe("buildDraftingPrompt", () => {
  it("frames the request with never-invent language and a forced output format", () => {
    const { system } = buildDraftingPrompt("Draft a staff briefing.", [structuredItem]);
    expect(system.toLowerCase()).toContain("never invent");
    expect(system).toContain("DRAFT:");
    expect(system).toContain("EVIDENCE_USED:");
  });

  it("tells the model no participant identity was given", () => {
    const { system } = buildDraftingPrompt("Draft a note.", [structuredItem]);
    expect(system.toLowerCase()).toContain("not given any participant name");
  });

  it("includes structured evidence fields, tagged with their id", () => {
    const { user } = buildDraftingPrompt("Draft a note.", [structuredItem]);
    expect(user).toContain("Evidence [ev-1]");
    expect(user).toContain("offer a visual countdown before transitions");
    expect(user).toContain("physical guiding without warning");
  });

  it("includes chunk excerpt and document metadata, tagged with their id", () => {
    const { user } = buildDraftingPrompt("Draft a note.", [chunkItem]);
    expect(user).toContain("Evidence [ev-2]");
    expect(user).toContain("seatbelt reminder before the vehicle moves");
    expect(user).toContain("Transport Safety Procedure");
  });

  it("never includes fields not present on AllowedEvidenceItem (no participant identifiers can leak — the type has none)", () => {
    const { user } = buildDraftingPrompt("Draft a note.", [structuredItem, chunkItem]);
    expect(user).not.toMatch(/participant[-_]?(ref|id|name)/i);
  });
});

describe("parseDraftResponse", () => {
  it("parses a well-formed response", () => {
    const text = "DRAFT: Offer a visual countdown before transitions.\nEVIDENCE_USED: ev-1, ev-2";
    expect(parseDraftResponse(text)).toEqual({
      draft: "Offer a visual countdown before transitions.",
      evidenceUsedIds: ["ev-1", "ev-2"],
    });
  });

  it("parses 'none' as an empty evidence list", () => {
    const text = "DRAFT: Not enough evidence to complete this request.\nEVIDENCE_USED: none";
    expect(parseDraftResponse(text)).toEqual({
      draft: "Not enough evidence to complete this request.",
      evidenceUsedIds: [],
    });
  });

  it("returns null when the response doesn't match the required format", () => {
    expect(parseDraftResponse("Sure, here's a draft.")).toBeNull();
    expect(parseDraftResponse("DRAFT: only this part")).toBeNull();
  });
});
