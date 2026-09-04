# Handoff: FIELD evidence layer — Milestone 1 + all four "next part" options shipped

Written for whoever (human or a fresh Claude session) picks this up next —
this file is the persistent record; don't rely on chat history surviving.

## Decisions Pol needs to make before more work continues

These are the two open items. Nothing is broken or blocking — both were
called out by the agents that built them as "worth a human sanity-check,"
not merge blockers, so they shipped as-is. Ask Pol which to prioritise (or
whether to leave them as-is a while longer) before touching either.

1. **`evidenceAuthorityTier` values on fracta-flow-field's 8 seeded
   strategies are a placeholder, not real classification.** They were set
   via a mechanical mapping (Strong evidence → tier 1, Emerging → tier 3,
   Practice-based → tier 5) during the schema-alignment migration, purely so
   the field exists and is populated. See
   `fracta-flow-field/src/lib/strategy-library/strategies.ts`. Needs a real
   pass — either manual clinical review, or wiring these records through
   `evidence-layer`'s actual tier logic once fracta-flow-field has a real
   evidence source.
2. **The AI-drafting service's "no invented claims" guard is a heuristic,
   not a guarantee.** `packages/ai-drafting-service/src/guard.ts` does a
   structural citation check (cited evidence ids must exist in what the
   model was given) plus a lexical-overlap heuristic — it cannot catch a
   claim built entirely from words already in the evidence vocabulary (e.g.
   a flipped negation: "never" → "always"), or a fabricated lowercase
   clinical term. A real guarantee needs an entailment/NLI check (e.g. a
   second, cheap model call to verify each output claim against the input
   evidence). Decide whether that's needed before this ships to real
   practitioners, or whether the heuristic + human review is acceptable for
   now.

## What shipped — Milestone 1 (commit `35a63a8`)

Two new workspace packages, built to let FIELD (the governed PBS/allied-health
workflow product) reuse `rag-work`'s proven, deterministic retrieval logic as
a secure evidence layer, without ever mutating `rag-work` itself.

### `packages/retrieval-core`

A byte-verified fork of `rag-work/src/lib`'s portable retrieval modules:
tokenizer/domain-vocab query expansion, BM25-style ranking with title/phrase/
procedure-intent boosts, extractive snippet selection, document ingestion
(chunking, PII/secret/prompt-injection screening, approval-status lifecycle),
and AES-256-GCM + HMAC blind-index crypto primitives.

Two deliberate changes from the original:
- `retrieval.ts`'s `retrieve()` (which called rag-work's own Postgres/
  local-file store) was dropped — only the pure extract/answer-assembly
  functions were kept. Host apps supply their own candidate lookup.
- `security.ts`'s `globalThis` single-unlocked-key singleton was replaced
  with plain functions that take the 32-byte key as a parameter
  (`encryptBytes(key, buf)`, `decryptBytes(key, buf)`, `blindIndexTokens(key,
  tokens)`) — rag-work's one-workspace-per-process assumption doesn't fit a
  multi-organisation host.

**Proof this didn't regress anything**: `benchmark/v2` (the frozen corpus +
fixtures + harness) was ported wholesale and run against a fresh baseline
captured from rag-work itself. Result: every metric delta was exactly 0, all
six quality gates passed. Command to reproduce:

```sh
# from a fresh rag-work checkout, capture the baseline
cd rag-work && npm install
node benchmark/v2/run-benchmark.mjs --output /tmp/baseline-rag-work

# from Fracta-Flow-AI
cd Fracta-Flow-AI && npm install
cd packages/retrieval-core
node benchmark/v2/run-benchmark.mjs --output .bench-output \
  --compare /tmp/baseline-rag-work/summary.json
```
All `comparison.*Delta` fields should be `0`. A freeze manifest
(`tests/fixtures/retrieval-freeze.json` + `scripts/verify-retrieval-freeze.mjs`)
guards `ranking.ts`/`text-search.ts`/`retrieval.ts`/the frozen corpus against
silent future changes — run `npm run verify:retrieval-freeze`.

A browser-safe subset lives in `src/browser.ts` (just `rankCandidates`/
`baseTokens`, no Node dependencies) — added when UI wiring hit a real bug:
importing the full `src/index.ts` from a browser pulled in Node-only document
ingestion deps (`mammoth`/`pdf-parse`, native `.node` binaries) that don't
load under `vite dev`. Use `browser.ts` from any browser-side code; the
frozen `ranking.ts`/`text-search.ts` themselves are untouched.

Public surface: see `src/index.ts` (Node/full) and `src/browser.ts`
(browser-safe subset).

### `packages/evidence-layer`

The new FIELD-specific layer, built on top of `@fracta-flow/retrieval-core`
(never modifying it):

- **`types.ts`** — `StructuredKnowledgeRecord` (authored, discrete PBS
  knowledge: strategy type, behaviour/risk, trigger context, early warning
  sign, staff action / staff action to avoid) and `EvidenceChunkRecord`
  (chunked free-text source material), both sharing governance fields:
  `approvalStatus` (reuses rag-work's `needs_review`/`approved`/`rejected`/
  `quarantined` states), `version`, `effectiveDate`, `current`,
  `supersededBy`, `evidenceAuthorityTier` (five levels, current participant
  plan down to historical/superseded), `participantRef` (`null` = org-wide).
- **`intent.ts`** — deterministic keyword classifier over ten PBS intent
  categories (proactive/reactive strategy, incident response, transport
  safety, restrictive practice, communication, risk, consent, assessment
  evidence, staff instruction, medication). A lookup table, not a model —
  every classification is explainable.
- **`workflow.ts`** — a pure `workflowContext → category weight` table
  (e.g. the `incident` workflow weights `incident_response` ×2.0), supplied
  explicitly by the host's workflow engine, never inferred from query text.
- **`ranking.ts`** — `rankEvidence(query, workflowContext, candidates)`: tier
  is a **hard gate** (partition by tier, only fall through to a lower tier
  if the higher one has zero qualifying hits), not a soft score nudge — a
  weak-scoring tier-1 record always beats a strong-scoring tier-4 one. Both
  `StructuredKnowledgeRecord` and `EvidenceChunkRecord` score through the
  exact same `rankCandidates` engine via `candidateAdapter.ts`, so tier/
  workflow weighting is the only behavioural difference between the two
  record shapes.
- **`supersession.ts`** — generalises `strategy-library`'s
  `resolveCurrentTemplate` chain-walk to any evidence record, plus
  `assertNoConflictingCurrent` — a write-time invariant blocking two
  `current: true` records for the same (participant, strategyType,
  triggerContext) tuple.

24 unit tests (tier priority, supersession chain-walking, workflow
sensitivity, participant scoping) plus a starter benchmark
(`benchmark/fixtures.ts` + `benchmark/run-benchmark.test.ts`, run as part of
`npm test`) with three gates: tier-correctness, supersession-correctness,
workflow-sensitivity. All passing.

## What shipped since — all four "next part" options are now done

### 1. UI wiring (`packages/strategy-library-app`)

Evidence-layer results are now surfaced live in the app:
- `src/lib/evidenceSeed.ts` — mock `StructuredKnowledgeRecord`/
  `EvidenceChunkRecord` candidates (org-wide procedures across tiers, two
  participant-scoped current plans with fixed demo ids `seed-participant-1`/
  `-2` — these won't match real locally-created participants, which use
  random UUIDs, so in normal use they never surface; this is intentional
  and still proves the scoping contract, but there's no live demo of a
  "current participant plan" tier hit without hand-seeding a matching id).
  No evidence-shaped backend route exists yet — this stands in for one the
  same way `SEED_TEMPLATES` does for strategies.
- `src/lib/evidenceQuery.ts` — `queryEvidence(query, workflowContext,
  activeParticipantId)`. Enforces participant scoping *before* candidates
  reach `rankEvidence`: only org-wide evidence plus the active participant's
  own records ever enter the candidate list.
- `src/components/EvidenceSearch.tsx` — search view (query + workflow-context
  select) showing authority tier, matched intent categories, workflow
  multiplier, and base/final score explicitly and un-collapsed (this is
  safety-critical explainability per the evidence-layer design). Wired into
  `App.tsx`'s nav.
- The app previously had no tests; vitest + `@testing-library/react` were
  added, with 12 new tests.

### 2. AI-drafting service (`packages/ai-drafting-service`)

Mirrors `strategy-library-server`'s existing pattern exactly:
- `evidenceAllowlist.ts` — the input-contract enforcement point.
  `AllowedEvidenceItem` has no `participantRef`/`sourceDocumentId`/name
  fields at all (not stripped — never present in the type), and
  independently re-validates `approvalStatus === "approved"` and
  `current === true` before trusting anything, regardless of whether the
  caller already filtered via `rankEvidence()`.
- `promptBuilder.ts` — explicit never-invent framing, forced output format.
- `anthropicClient.ts` — same 4-way outcome classification as
  strategy-library-server (success / refusal / network_error / api_error).
- `guard.ts` — best-effort no-invented-claims check. **See the open decision
  at the top of this file — this is a heuristic, not a guarantee.**
- 39 tests (prompt builder, client wrapper with mocked network calls,
  evidence allowlist, guard, route across all 4 outcome classes).
- Model default follows strategy-library-server's existing choice
  (`claude-sonnet-4-5` via `ANTHROPIC_MODEL` env var) to keep the two
  services consistent — revisit together if moving either to a newer model.
- Not scanned: the practitioner's free-text `instruction` field isn't
  checked for PII — the structural no-identity guarantee is on the evidence
  path only. Worth a decision if practitioners might type identifying
  detail into that field.

### 3. Frame eligibility-code integration (`packages/frame-eligibility-codes`)

Explicitly a **stub** — there is no live Frame system to integrate with yet:
- Versioned opaque-code format, e.g. `"1AXs"` → `{diagnosisCategory:
  "autism", ageBand: "13-17", supportComplexity: "standard"}`. The version
  is the code's own first character; `decodeEligibilityCode` always
  resolves it against `CODE_SETS` before letter lookup, so an old code can
  never be silently reinterpreted under a future table.
- Pure `decodeEligibilityCode`/`encodeEligibility` (`src/codec.ts`) — no
  network, no throwing on malformed input (returns `null`). Identity can't
  flow through by construction: closed enumerated types plus a runtime
  `assertNoIdentityLeakage` scan for spread-assembled values.
- Thin adapter (`src/adapter.ts`) — `toEligibilityFilters()` maps onto
  `participant-profile`'s `EligibilityFilters`; `restrictToOrgWideEvidence`
  + `buildEligibilityAwareQuery` show how to feed `evidence-layer`'s
  `rankEvidence` (narrowed to org-wide `participantRef === null` records,
  since a Frame code carries no participant linkage).
- `// STUB:` markers + a README section flag what's illustrative (the
  diagnosis/age-band/complexity taxonomy, letter mappings) vs. structurally
  real (the versioning mechanism, the identity boundary). **The real
  code↔category taxonomy is still an open decision** for whoever owns the
  actual Frame↔FIELD handoff — not listed as a top decision above because
  no real Frame system exists yet to make it urgent.
- 28 tests: round-trip encode/decode, malformed-input handling,
  version-mismatch, `@ts-expect-error` type-level identity-rejection checks,
  adapter wiring including a real `classifyIntent` integration check.

### 4. `fracta-flow-field` schema alignment (separate repo)

Decided: migrate fracta-flow-field onto Fracta-Flow-AI's richer schema
(rather than stay a separate, thinner model). Done as schema alignment only
— no evidence-layer/retrieval-core integration yet, so the two products can
share that code later without another rewrite.

fracta-flow-field turned out to have no D1/backend persistence for
participant/strategy data — the Worker only handles auth/entitlement/Stripe
via KV. Participant profiles and personalisation drafts live in browser
`localStorage`; strategies are a static array. No server-side migration was
needed as a result.

- `ParticipantProfile` — added `eligibilityFilters` (age range, cultural
  safety flags, excluded support types, guardian consent) matching
  Fracta-Flow-AI's shape field-for-field, plus `dateOfBirth`,
  `culturalSafetyNotes`, `schemaVersion`, `createdAt`/`updatedAt`.
- `Strategy` → `StrategyTemplate` — renamed to match Fracta-Flow-AI;
  `variants` → `personalisationRecords`; added governance fields (`version`,
  `approvalStatus`, `effectiveDate`, `current`, `supersededBy`,
  **`evidenceAuthorityTier`** — see open decision #1 above), plus
  `ageRange`, `culturalSafetyNotes`, and `resolveCurrentTemplate`
  (cycle-guarded chain-walk).
- Deliberate deviations: `PersonalisationRecord.participantRef` is optional
  (these are pre-authored generic templates, not per-participant records);
  the legacy `superseded: SupersededInfo` display field was kept as
  `supersededInfo` (a "figure updated" UI note) rather than folded into the
  governance chain.
- Migration path: `migrations.ts` upgrades old (no-`schemaVersion`) records.
  `storage.ts` reads `field.participant-profile.v2` first, falls back to
  legacy `v1`, migrates and re-persists under `v2` — old key untouched
  (rollback-safe). Corrupt data falls back to demo data rather than
  crashing.

## Deliberately NOT touched

- **`rag-work`** — zero commits, zero pushes, throughout all of the above.
  It's a pure copy source; its benchmark and credibility as a standalone
  project stay intact.
- No real Frame system exists — item 3 above is a stub only.
- No real evidence source feeds fracta-flow-field yet — its
  `evidenceAuthorityTier` values are placeholders (open decision #1).

## How to verify current state

**Fracta-Flow-AI** (branch `claude/participant-profile-module-05hh98`):
```sh
cd Fracta-Flow-AI
npm install
cd packages/retrieval-core && npm run build && cd ../..  # build this first — npm workspaces
                                                            # don't topologically order, and
                                                            # evidence-layer/ai-drafting-service/
                                                            # strategy-library-app depend on it
npm run build --workspaces --if-present   # all 8 packages compile clean
npm test --workspaces --if-present        # all suites pass (174 tests total)
```

**fracta-flow-field** (branch `claude/fracta-flow-field-launch-n6s7jb`):
```sh
cd fracta-flow-field
npm install
npm run build
npm run worker:typecheck
npm test   # 14 tests total
```

## Next part — not yet decided

Beyond the two decisions at the top of this file, no further scope has been
agreed. Whoever picks this up: ask Pol what's next before starting — don't
assume.
