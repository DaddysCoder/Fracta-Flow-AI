# Frame Eligibility Codes

**STUB / design scaffold — not a real integration.** There is no live
"Frame" system connected here. This package exists to pin down a versioned
opaque-code *contract* a real Frame&nbsp;&lt;-&gt;&nbsp;FIELD integration can
be built against later, plus enough working plumbing (encode/decode,
round-trip tests, a candidate-filtering adapter into `evidence-layer`) to
prove the shape actually works end-to-end with fake data.

## The idea

Frame computes a de-identified eligibility bucket locally (diagnosis
category, age band, ...) and hands FIELD only an opaque code — never a
name, DOB, or participant reference. FIELD decodes the code into a small,
closed set of categories and uses *those* to pre-filter/weight strategy and
evidence content. Identity never crosses the boundary.

## What's real here

- The **code format** is structural, not a convention: every code carries
  its lookup-table version as its own first character, and
  `decodeEligibilityCode` always resolves that version's table before
  looking up any letter — an old code can never silently be reinterpreted
  under a newer table (see `src/codeSets.ts`, `src/codec.ts`).
- `decodeEligibilityCode` / `encodeEligibility` are pure, dependency-free,
  and make no network calls.
- The type surface (`DecodedEligibility`, `EligibilityInput`) is a closed
  set of enumerated fields with no free-text/id field — there is nowhere to
  add participant identity without editing this package's `types.ts`. A
  runtime scan (`assertNoIdentityLeakage`) backs that up for values
  assembled via spread rather than a literal, where TypeScript's
  excess-property check can't see the extra field. See
  `tests/type-safety.test.ts` for the `@ts-expect-error` cases and
  `tests/codec.test.ts` for the runtime ones.
- `restrictToOrgWideEvidence` is a real, defensible constraint: a Frame code
  never carries a `participantRef`, so FIELD has no basis to select a
  *specific* participant's plan from a code alone — only org-wide evidence
  (`participantRef === null`) is ever in scope for a code-only lookup.

## What's fake / illustrative only (STUB)

Marked `// STUB:` at each definition site — look for that comment to find
every fake value in the source.

- **`DiagnosisCategory`, `AgeBand`, `SupportComplexity`** (`src/types.ts`)
  — five diagnosis buckets, six age bands, a two-value complexity flag.
  Picked to be plausible and exercise the code format, not because they're
  a real clinical taxonomy. The real dimensions (and how many of them there
  should be) is a decision for whoever owns the actual Frame&lt;-&gt;FIELD
  handoff, not something this stub should be read as pre-deciding.
- **`CODE_SET_V1`'s letter mappings** (`src/codeSets.ts`) — arbitrary letter
  choices, not a published/shared standard with a real Frame system.
- **`DIAGNOSIS_QUERY_HINTS`** (`src/adapter.ts`) — a made-up diagnosis ->
  query-hint-term table, chosen only so it lines up with evidence-layer's
  existing `intent.ts` trigger phrases well enough to demonstrate the wiring
  compiles and runs. Not clinical guidance.
- **Age-band midpoints in `toEligibilityFilters`** — a coarse, lossy
  approximation (band midpoint standing in for participant-profile's exact
  `age: number`). Treat any age value produced this way as advisory only,
  matching `strategy-library/src/eligibility.ts`'s existing
  pass-through-not-hard-gate stance on `EligibilityFilters`.

## How it fits the rest of the workspace

- `toEligibilityFilters(decoded)` -> `@fracta-flow/participant-profile`'s
  `EligibilityFilters` shape (`{ age, culturalConstraints }`), for reuse
  with `@fracta-flow/strategy-library`'s `filterEligibleTemplates`.
- `buildEligibilityAwareQuery(query, decoded)` + `restrictToOrgWideEvidence`
  -> a concrete "how would a decoded code feed
  `@fracta-flow/evidence-layer`'s `rankEvidence`" starting point: narrow
  candidates to org-wide evidence first, fold the diagnosis hint into the
  query text, then call `rankEvidence` exactly as any other caller would.
  No file in `evidence-layer` needed to change for this to compose.

## Usage

```ts
import { decodeEligibilityCode, encodeEligibility } from "@fracta-flow/frame-eligibility-codes";
import { toEligibilityFilters, buildEligibilityAwareQuery, restrictToOrgWideEvidence } from "@fracta-flow/frame-eligibility-codes";
import { rankEvidence } from "@fracta-flow/evidence-layer";

// Fixture generation (test/dev only — a real Frame system mints these):
const code = encodeEligibility({
  diagnosisCategory: "autism",
  ageBand: "13-17",
  supportComplexity: "standard",
}); // "1AXs"

// FIELD-side decode of an opaque code it received from Frame:
const decoded = decodeEligibilityCode(code!);
if (!decoded) {
  // malformed code, or minted under a table version this build doesn't know about
} else {
  const filters = toEligibilityFilters(decoded); // -> EligibilityFilters
  const eligibleCandidates = restrictToOrgWideEvidence(candidates);
  const query = buildEligibilityAwareQuery("what strategies help", decoded);
  const hits = rankEvidence(query, "daily_support", eligibleCandidates);
}
```

## Development

```bash
npm install
npm run build       # compile TypeScript to dist/
npm test            # typecheck (incl. tests/ @ts-expect-error checks) + vitest
```
