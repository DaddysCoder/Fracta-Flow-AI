import { CURRENT_CODE_SET_VERSION, getCodeSet } from "./codeSets";
import type { CodeSetTable, CodeSetVersion, DecodedEligibility, EligibilityInput } from "./types";

/**
 * Opaque code format: `<versionDigit><diagnosisLetter><ageBandLetter><complexityLetter>`
 * — e.g. `"1AXs"` decodes (against the v1 table) to
 * `{ diagnosisCategory: "autism", ageBand: "13-17", supportComplexity: "standard" }`.
 *
 * The version digit is not decoration: it's the first character of every
 * code, always present, always checked before any letter lookup happens.
 * That's what makes this "versioned" a structural property of the format
 * rather than a convention someone could forget to follow.
 */
const CODE_PATTERN = /^([1-9])([A-Za-z])([A-Za-z])([a-z])$/;

const VERSION_DIGITS: Readonly<Record<CodeSetVersion, string>> = {
  v1: "1",
};

const DIGIT_TO_VERSION: Readonly<Record<string, CodeSetVersion>> = Object.fromEntries(
  Object.entries(VERSION_DIGITS).map(([version, digit]) => [digit, version as CodeSetVersion])
);

/**
 * Defence-in-depth runtime scan. TypeScript's structural typing already
 * makes it impossible to *declare* a `DecodedEligibility`/`EligibilityInput`
 * value carrying identity fields, and excess-property checking rejects an
 * object literal with one at compile time (see tests/type-safety.test.ts)
 * — but structural typing can't catch a value assembled via spread from an
 * untyped/`any` source. This closes that gap for anything that reaches
 * `encodeEligibility` at runtime.
 */
const FORBIDDEN_KEYS = [
  "participantRef",
  "participantId",
  "name",
  "firstName",
  "lastName",
  "fullName",
  "dob",
  "dateOfBirth",
  "ndisNumber",
  "email",
  "phone",
  "address",
] as const;

export function assertNoIdentityLeakage(value: object): void {
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(
        `frame-eligibility-codes: refused a value carrying "${key}" — this module must never see participant identity, only the decoded eligibility bucket.`
      );
    }
  }
}

function letterFor(map: Readonly<Record<string, string>>, value: string): string | null {
  for (const [letter, mapped] of Object.entries(map)) {
    if (mapped === value) return letter;
  }
  return null;
}

/**
 * Pure decode. Returns `null` (never throws) for a malformed code, an
 * unknown version digit, or a letter with no entry in that version's
 * table — decoding is either a clean success or a clean "I don't
 * understand this", by design, since a Frame-issued code reaching FIELD is
 * untrusted input.
 */
export function decodeEligibilityCode(code: string): DecodedEligibility | null {
  const match = CODE_PATTERN.exec(code);
  if (!match) return null;

  const [, versionDigit, diagnosisLetter, ageBandLetter, complexityLetter] = match;
  const version = DIGIT_TO_VERSION[versionDigit];
  if (!version) return null;

  const table: CodeSetTable | null = getCodeSet(version);
  if (!table) return null;

  const diagnosisCategory = table.diagnosisLetters[diagnosisLetter];
  const ageBand = table.ageBandLetters[ageBandLetter];
  const supportComplexity = table.complexityLetters[complexityLetter];
  if (!diagnosisCategory || !ageBand || !supportComplexity) return null;

  return { codeSetVersion: version, diagnosisCategory, ageBand, supportComplexity };
}

/**
 * Pure inverse of `decodeEligibilityCode`, for generating test/dev
 * fixtures. Defaults to the current code set version; pass one explicitly
 * to mint a fixture for testing version-mismatch handling. Returns `null`
 * (never throws) if the requested version's table has no letter for one of
 * the given values — e.g. asking for a `DiagnosisCategory` that only
 * exists in a hypothetical future table version.
 */
export function encodeEligibility(input: EligibilityInput, version: CodeSetVersion = CURRENT_CODE_SET_VERSION): string | null {
  assertNoIdentityLeakage(input);

  const table = getCodeSet(version);
  const versionDigit = VERSION_DIGITS[version];
  if (!table || !versionDigit) return null;

  const diagnosisLetter = letterFor(table.diagnosisLetters, input.diagnosisCategory);
  const ageBandLetter = letterFor(table.ageBandLetters, input.ageBand);
  const complexityLetter = letterFor(table.complexityLetters, input.supportComplexity);
  if (!diagnosisLetter || !ageBandLetter || !complexityLetter) return null;

  return `${versionDigit}${diagnosisLetter}${ageBandLetter}${complexityLetter}`;
}
