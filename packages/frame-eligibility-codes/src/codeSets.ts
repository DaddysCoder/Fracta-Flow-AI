import type { CodeSetTable, CodeSetVersion } from "./types";

/**
 * STUB: illustrative code<->category lookup table, not a real clinical
 * taxonomy. A real version of this table is a product/clinical decision
 * (with Frame's team, presumably) that hasn't been made yet — see this
 * package's README.
 *
 * Structural note on "versioned": the version isn't just a comment on this
 * file — it's a required field embedded in every opaque code string (see
 * `codec.ts`'s `CODE_PATTERN`) and a required key of `CODE_SETS` below.
 * Decoding always looks the code's own version up in this map first; if a
 * future `v2` table is added, `v1` codes keep decoding against the `v1`
 * table forever, never silently reinterpreted under `v2`'s letters.
 */
// STUB: arbitrary letter mappings, not a published/shared standard with a real Frame system.
const CODE_SET_V1: CodeSetTable = {
  version: "v1",
  diagnosisLetters: {
    A: "autism",
    B: "intellectual_disability",
    C: "psychosocial_disability",
    D: "acquired_brain_injury",
    E: "other_developmental",
  },
  ageBandLetters: {
    V: "0-5",
    W: "6-12",
    X: "13-17",
    Y: "18-24",
    Z: "25-64",
    U: "65+",
  },
  complexityLetters: {
    s: "standard",
    h: "high",
  },
};

export const CODE_SETS: Readonly<Record<CodeSetVersion, CodeSetTable>> = {
  v1: CODE_SET_V1,
};

export function getCodeSet(version: string): CodeSetTable | null {
  return Object.prototype.hasOwnProperty.call(CODE_SETS, version) ? CODE_SETS[version as CodeSetVersion] : null;
}

/** The version new codes are minted against unless a caller deliberately targets an older one (e.g. for fixtures exercising version-mismatch handling). */
export const CURRENT_CODE_SET_VERSION: CodeSetVersion = "v1";
