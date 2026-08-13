import { describe, it, expect } from "vitest";
import { extractAllowedAxisData, isEntirelyEmpty } from "../src/axisData";

describe("extractAllowedAxisData", () => {
  it("only extracts axes the template declared, dropping everything else", () => {
    const raw = {
      interests: { general: ["trains"], strengths: [], dislikes: [] },
      communication_style: { mode: "AAC", indicatesNoOrDiscomfort: "pushes away" },
      // Not a real axis — must never survive into the result.
      culturalConstraints: "should never appear",
    };

    const result = extractAllowedAxisData(raw, ["interests"]);
    expect(result).toEqual({ interests: { general: ["trains"], strengths: [], dislikes: [] } });
    expect(result).not.toHaveProperty("communication_style");
  });

  it("drops malformed field values rather than passing them through", () => {
    const raw = { interests: { general: "not an array", strengths: null, dislikes: undefined } };
    const result = extractAllowedAxisData(raw, ["interests"]);
    expect(result.interests).toEqual({ general: [], strengths: [], dislikes: [] });
  });

  it("returns an empty map for non-object input", () => {
    expect(extractAllowedAxisData(null, ["interests"])).toEqual({});
    expect(extractAllowedAxisData("string", ["interests"])).toEqual({});
  });

  it("does not force-drop thin/minimal data — a single value is preserved as-is", () => {
    const raw = { interests: { general: ["one thing"], strengths: [], dislikes: [] } };
    const result = extractAllowedAxisData(raw, ["interests"]);
    expect(result.interests?.general).toEqual(["one thing"]);
  });
});

describe("isEntirelyEmpty", () => {
  it("is true when no axis has any usable content", () => {
    expect(isEntirelyEmpty({})).toBe(true);
    expect(isEntirelyEmpty({ interests: { general: [], strengths: [], dislikes: [] } })).toBe(true);
  });

  it("is false when any single field has content", () => {
    expect(isEntirelyEmpty({ interests: { general: ["trains"], strengths: [], dislikes: [] } })).toBe(false);
    expect(
      isEntirelyEmpty({ communication_style: { mode: "", indicatesNoOrDiscomfort: "pushes away" } })
    ).toBe(false);
  });
});
