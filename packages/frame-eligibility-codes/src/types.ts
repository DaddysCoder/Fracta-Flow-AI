/**
 * STUB — Frame <-> FIELD eligibility-code contract.
 *
 * This is a design scaffold for a handoff that does not exist yet: there is
 * no real "Frame" system integrated here. The goal is a versioned code
 * format and decode/encode contract a real integration can be built
 * against later, plus enough plumbing to prove the shape works end-to-end
 * with fake data. The lookup-table *contents* below (diagnosis categories,
 * age bands, complexity flags) are illustrative placeholders, not a real
 * clinical taxonomy — see this package's README for what's fake vs. real.
 *
 * Non-negotiable design constraint (the whole point of the handoff): Frame
 * computes a de-identified eligibility bucket locally and passes only the
 * opaque code to FIELD. FIELD never receives, stores, or has any type in
 * this module capable of carrying participant identity (name, DOB,
 * participant ID/ref, address, contact details, etc). Every exported type
 * and function signature in this package is built from closed, enumerated
 * shapes for exactly that reason — there is nowhere for a free-text
 * identity field to be added to a `DecodedEligibility` without changing
 * this file, and `assertNoIdentityLeakage` (codec.ts) is a runtime
 * belt-and-braces check for the cases TypeScript's structural typing alone
 * can't catch (e.g. an identity field arriving via object spread rather
 * than as a literal).
 */

/**
 * The lookup table version a code was minted against. Bump this whenever
 * the letter->category mappings change, so an old code can never be
 * silently reinterpreted under a new table — decoding a code against the
 * wrong version's table is treated as a hard failure (`null`), never a
 * best-effort guess.
 */
export type CodeSetVersion = "v1";

// STUB: illustrative categories only, not a real clinical taxonomy — see README "What's fake".
export type DiagnosisCategory =
  | "autism"
  | "intellectual_disability"
  | "psychosocial_disability"
  | "acquired_brain_injury"
  | "other_developmental";

// STUB: illustrative age bands only, not a real clinical taxonomy — see README "What's fake".
export type AgeBand = "0-5" | "6-12" | "13-17" | "18-24" | "25-64" | "65+";

/**
 * STUB: a coarse support-complexity flag, illustrative only. Included to
 * show the code format can carry more than two dimensions without changing
 * shape — a real taxonomy will very likely need more/different dimensions
 * than this.
 */
export type SupportComplexity = "standard" | "high";

/**
 * The decoded, de-identified eligibility bucket. Deliberately a closed set
 * of enumerated fields — no free-text field, no id field, nothing an
 * identity value could be smuggled through.
 */
export interface DecodedEligibility {
  readonly codeSetVersion: CodeSetVersion;
  readonly diagnosisCategory: DiagnosisCategory;
  readonly ageBand: AgeBand;
  readonly supportComplexity: SupportComplexity;
}

/** Input to `encodeEligibility` — same closed shape, minus the version (supplied separately so callers can target an older code set on purpose, e.g. for fixtures/tests). */
export type EligibilityInput = Omit<DecodedEligibility, "codeSetVersion">;

/**
 * One version of the code<->category lookup table. `letters` map single
 * characters (as they appear in the opaque code string) to/from each
 * enumerated dimension. Kept as plain bidirectional maps (not a single
 * "clever" bijection) so the table is easy to read, audit, and diff in
 * review — exactly the property a shared, versioned contract needs.
 */
export interface CodeSetTable {
  readonly version: CodeSetVersion;
  readonly diagnosisLetters: Readonly<Record<string, DiagnosisCategory>>;
  readonly ageBandLetters: Readonly<Record<string, AgeBand>>;
  readonly complexityLetters: Readonly<Record<string, SupportComplexity>>;
}
