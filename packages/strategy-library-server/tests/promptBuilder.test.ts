import { describe, it, expect } from "vitest";
import { SEED_TEMPLATES } from "@fracta-flow/strategy-library";
import { buildPersonalisationPrompt, parseGenerationResponse } from "../src/promptBuilder";

const visualScheduling = SEED_TEMPLATES.find((t) => t.id === "visual-scheduling")!;
const reactiveWithBoundary = SEED_TEMPLATES.find((t) => t.id === "reactive-strategies")!;

describe("buildPersonalisationPrompt", () => {
  it("fixes the mechanism and instructs the model not to change it", () => {
    const { system } = buildPersonalisationPrompt(visualScheduling, {
      interests: { general: ["trains"], strengths: [], dislikes: [] },
    });
    expect(system).toContain(visualScheduling.mechanism);
    expect(system.toLowerCase()).toContain("never invent");
  });

  it("states the safety boundary as a hard constraint when present", () => {
    const { system } = buildPersonalisationPrompt(reactiveWithBoundary, {
      interests: { general: ["music"], strengths: [], dislikes: [] },
    });
    expect(system).toContain(reactiveWithBoundary.safetyBoundary);
  });

  it("omits a safety-boundary line entirely when the template has none", () => {
    const { system } = buildPersonalisationPrompt(visualScheduling, {
      interests: { general: ["trains"], strengths: [], dislikes: [] },
    });
    expect(system).not.toContain("Hard safety constraint");
  });

  it("includes only the provided axis field values, not participant identifiers", () => {
    const { user } = buildPersonalisationPrompt(visualScheduling, {
      interests: { general: ["trains", "dinosaurs"], strengths: ["puzzles"], dislikes: [] },
    });
    expect(user).toContain("trains, dinosaurs");
    expect(user).toContain("puzzles");
    expect(user).not.toMatch(/participant[-_]?id/i);
  });

  it("never sends the practitioner's capacity-adaptation note to the model — Step 2 is not an AI call", () => {
    // buildPersonalisationPrompt intentionally has no parameter for it.
    // This test pins that contract: adding one back would be a deliberate
    // spec change, not an accident.
    expect(buildPersonalisationPrompt.length).toBe(2);
  });
});

describe("parseGenerationResponse", () => {
  it("parses a well-formed response", () => {
    const text =
      "PERSONALISED_ACTIVITY: Use a train-themed picture schedule.\nKEPT_FIXED: Kept the visual sequencing mechanism intact.";
    const parsed = parseGenerationResponse(text);
    expect(parsed).toEqual({
      personalisedActivity: "Use a train-themed picture schedule.",
      keptFixedStatement: "Kept the visual sequencing mechanism intact.",
    });
  });

  it("returns null when the response doesn't match the required format", () => {
    expect(parseGenerationResponse("Sure, here's an idea: use pictures.")).toBeNull();
    expect(parseGenerationResponse("PERSONALISED_ACTIVITY: only this part")).toBeNull();
  });
});
