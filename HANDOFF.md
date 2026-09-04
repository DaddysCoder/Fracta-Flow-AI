# Handoff: FIELD evidence layer, Milestone 1 complete

Written for whoever (human or a fresh Claude session) picks this up next —
this file is the persistent record; don't rely on chat history surviving.

## What shipped (commit `35a63a8`, merged via PR into this branch)

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

Public surface: see `src/index.ts` — re-exports everything above.

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

## Deliberately NOT touched

- **`rag-work`** — zero commits, zero pushes. It's a pure copy source; its
  benchmark and credibility as a standalone project stay intact.
- **`fracta-flow-field`** — the separate, thinner-schema consumer app. No
  schema alignment decision has been made yet; touching it was explicitly
  out of scope for this pass.
- No UI wiring (nothing in `strategy-library-app` reads from `evidence-layer`
  yet), no AI-drafting service, no Frame integration.

## How to verify current state

```sh
cd Fracta-Flow-AI
npm install
npm run build --workspaces --if-present   # all 6 packages compile clean
npm test --workspaces --if-present        # all suites pass (95 tests total)
```

## Next part — pick one (not yet decided)

These were discussed but deliberately deferred to keep Milestone 1 bounded:

1. **UI wiring** — surface `evidence-layer` results in
   `packages/strategy-library-app` (currently reads only static
   `SEED_TEMPLATES`; would need a real evidence query path).
2. **AI-drafting service** — a new service mirroring
   `packages/strategy-library-server`'s existing pattern exactly (server-side
   lookup → field allowlist → tightly scoped prompt with explicit "preserve
   this, never invent that" framing → forced output format → 4-way error
   classification), scoped to draft/explain *after* `rankEvidence` has
   already selected the evidence — never given raw participant identity or
   unapproved documents. This is the natural home for the "paid feature, LLM
   sees no participant data, just combines/adds to what secure FIELD already
   selected" flow discussed with Pol.
3. **Frame eligibility-code integration** — a stub for the opaque-code
   handoff (Frame computes a de-identified eligibility bucket like `AXy` →
   `{diagnosis category, age band, ...}` locally and passes only the code to
   FIELD; FIELD never holds identity). Needs a shared, versioned code↔category
   lookup table design before this can be built for real.
4. **`fracta-flow-field` schema alignment** — decide whether it migrates onto
   `Fracta-Flow-AI`'s richer schema or stays a separate, thinner product, then
   act on that decision. Currently genuinely undecided — see the two repos'
   diverged `ParticipantProfile`/`Strategy` shapes.

Whoever picks this up: ask Pol which of these (or something else) is next
before starting — don't assume.
