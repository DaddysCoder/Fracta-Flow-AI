import { describe, expect, it } from "vitest";
import { encodeEligibility } from "../src/codec";
import { toEligibilityFilters } from "../src/adapter";
import { decodeEligibilityCode } from "../src/codec";
import type { EligibilityInput } from "../src/types";

/**
 * Type-level guarantee that identity can't flow through this module's
 * public API. `EligibilityInput`/`DecodedEligibility` are closed shapes, so
 * TypeScript's excess-property check rejects an object *literal* carrying
 * an identity-shaped field at the call site — these `@ts-expect-error`
 * lines fail `tsc` (and this test's `expect(() => ...).toThrow()` at
 * runtime, via `assertNoIdentityLeakage`) the moment someone tries.
 * Removing the `@ts-expect-error` comment should make `npm run build`
 * fail here — that's the check.
 */
describe("type-level identity guarantee", () => {
  it("rejects a participantRef on an eligibility input object literal (compile-time)", () => {
    const withParticipantRef: EligibilityInput = {
      diagnosisCategory: "autism",
      ageBand: "13-17",
      supportComplexity: "standard",
      // @ts-expect-error — participantRef is not a key of EligibilityInput; TS's excess-property check on this object literal must reject it.
      participantRef: "p-123",
    };
    expect(() => encodeEligibility(withParticipantRef)).toThrow(/participantRef/);
  });

  it("rejects a name field on an eligibility input object literal (compile-time)", () => {
    const withName: EligibilityInput = {
      diagnosisCategory: "autism",
      ageBand: "13-17",
      supportComplexity: "standard",
      // @ts-expect-error — name is not a key of EligibilityInput.
      name: "Jane Doe",
    };
    expect(() => encodeEligibility(withName)).toThrow(/name/);
  });

  it("rejects passing an identity-shaped object literal directly as the call argument (compile-time)", () => {
    expect(() =>
      encodeEligibility({
        diagnosisCategory: "autism",
        ageBand: "13-17",
        supportComplexity: "standard",
        // @ts-expect-error — dob is not a key of EligibilityInput; excess property check on this literal argument must reject it.
        dob: "2010-01-01",
      })
    ).toThrow(/dob/);
  });

  it("decodeEligibilityCode's return type has no identity field to populate even on a successful decode", () => {
    const decoded = decodeEligibilityCode("1AXs");
    expect(decoded).not.toBeNull();
    // @ts-expect-error — participantRef is not a key of DecodedEligibility; there is nowhere to read/write identity from a decoded value.
    expect(decoded!.participantRef).toBeUndefined();
  });

  it("toEligibilityFilters's output never carries an identity field either", () => {
    const decoded = decodeEligibilityCode("1AXs")!;
    const filters = toEligibilityFilters(decoded);
    expect(Object.keys(filters).sort()).toEqual(["age", "culturalConstraints"]);
  });
});
