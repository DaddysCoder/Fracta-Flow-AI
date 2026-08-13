import { describe, it, expect } from "vitest";
import { resolveCurrentTemplate } from "../src/supersede";
import { SEED_TEMPLATES } from "../src/seed/templates";

describe("resolveCurrentTemplate (pure, storage-agnostic)", () => {
  it("resolves the supersededBy chain from an in-memory array", () => {
    const current = resolveCurrentTemplate("positive-behaviour-support", SEED_TEMPLATES);
    expect(current?.id).toBe("differential-reinforcement");
  });

  it("returns the template itself when nothing supersedes it", () => {
    const current = resolveCurrentTemplate("skills-teaching", SEED_TEMPLATES);
    expect(current?.id).toBe("skills-teaching");
  });

  it("returns null for an unknown id", () => {
    expect(resolveCurrentTemplate("does-not-exist", SEED_TEMPLATES)).toBeNull();
  });

  it("does not infinite-loop on a cycle", () => {
    const a = { ...SEED_TEMPLATES[0], id: "a", supersededBy: "b" };
    const b = { ...SEED_TEMPLATES[0], id: "b", supersededBy: "a" };
    const result = resolveCurrentTemplate("a", [a, b]);
    expect(result).not.toBeNull();
  });
});
