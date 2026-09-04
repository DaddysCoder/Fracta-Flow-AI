import { describe, expect, it } from "vitest";
import { decodeEligibilityCode, encodeEligibility, assertNoIdentityLeakage } from "../src/codec";
import type { DecodedEligibility, EligibilityInput } from "../src/types";

const SAMPLE_INPUTS: EligibilityInput[] = [
  { diagnosisCategory: "autism", ageBand: "13-17", supportComplexity: "standard" },
  { diagnosisCategory: "intellectual_disability", ageBand: "0-5", supportComplexity: "high" },
  { diagnosisCategory: "psychosocial_disability", ageBand: "25-64", supportComplexity: "high" },
  { diagnosisCategory: "acquired_brain_injury", ageBand: "65+", supportComplexity: "standard" },
  { diagnosisCategory: "other_developmental", ageBand: "18-24", supportComplexity: "standard" },
];

describe("encodeEligibility / decodeEligibilityCode round-trip", () => {
  for (const input of SAMPLE_INPUTS) {
    it(`round-trips ${JSON.stringify(input)}`, () => {
      const code = encodeEligibility(input);
      expect(code).not.toBeNull();
      expect(code).toMatch(/^[1-9][A-Za-z][A-Za-z][a-z]$/);

      const decoded = decodeEligibilityCode(code!);
      expect(decoded).toEqual<DecodedEligibility>({
        codeSetVersion: "v1",
        ...input,
      });
    });
  }

  it("produces a stable, deterministic code for the same input", () => {
    const a = encodeEligibility(SAMPLE_INPUTS[0]);
    const b = encodeEligibility(SAMPLE_INPUTS[0]);
    expect(a).toBe(b);
  });
});

describe("decodeEligibilityCode: malformed / untrusted input", () => {
  it("returns null for an empty string", () => {
    expect(decodeEligibilityCode("")).toBeNull();
  });

  it("returns null for the wrong length", () => {
    expect(decodeEligibilityCode("1AX")).toBeNull();
    expect(decodeEligibilityCode("1AXsz")).toBeNull();
  });

  it("returns null for a missing/invalid version digit", () => {
    expect(decodeEligibilityCode("0AXs")).toBeNull(); // 0 is not a valid version digit
    expect(decodeEligibilityCode("9AXs")).toBeNull(); // no v9 table exists
  });

  it("returns null for an unknown diagnosis letter within a known version", () => {
    expect(decodeEligibilityCode("1QXs")).toBeNull(); // Q is not in the v1 diagnosisLetters table
  });

  it("returns null for an unknown age-band letter", () => {
    expect(decodeEligibilityCode("1AQs")).toBeNull();
  });

  it("returns null for an unknown complexity letter", () => {
    expect(decodeEligibilityCode("1AXq")).toBeNull();
  });

  it("never throws on garbage input", () => {
    for (const garbage of ["not-a-code", "🙂🙂🙂🙂", "1234", "", "AXsy1"]) {
      expect(() => decodeEligibilityCode(garbage)).not.toThrow();
    }
  });
});

describe("version-mismatch handling", () => {
  it("encoding against an unknown version returns null rather than guessing", () => {
    // @ts-expect-error — deliberately passing an unsupported version to prove the runtime guard, not just the type.
    const code = encodeEligibility(SAMPLE_INPUTS[0], "v2");
    expect(code).toBeNull();
  });

  it("a code minted under a hypothetical future table never gets reinterpreted under v1's letters", () => {
    // Simulates a v2-minted code landing on code that only knows about v1 —
    // the version digit "2" has no entry in DIGIT_TO_VERSION yet, so this
    // must fail closed, not fall back to decoding the rest against v1.
    expect(decodeEligibilityCode("2AXs")).toBeNull();
  });
});

describe("assertNoIdentityLeakage", () => {
  it("passes through a clean eligibility input", () => {
    expect(() => assertNoIdentityLeakage(SAMPLE_INPUTS[0])).not.toThrow();
  });

  it("throws if a value carries an identity-shaped field, even via spread", () => {
    const tainted = { ...SAMPLE_INPUTS[0], participantRef: "p-123" };
    expect(() => assertNoIdentityLeakage(tainted)).toThrow(/participantRef/);
  });

  it("encodeEligibility itself refuses a spread-in identity field at runtime", () => {
    const tainted: EligibilityInput & { name?: string } = { ...SAMPLE_INPUTS[0], name: "Jane Doe" };
    expect(() => encodeEligibility(tainted)).toThrow(/name/);
  });
});
