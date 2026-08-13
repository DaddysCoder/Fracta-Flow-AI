# Strategy Library App

Phase 1 MVP UI for the Strategy Library: browse/filter evidence-based PBS
strategies and author `PersonalisationRecord`s. Vite + React + TypeScript
+ Tailwind, PWA (offline-capable).

## What's here

- **Consent gate** (`src/components/ConsentGate.tsx`) — decision-support,
  not-diagnostic disclaimer, blocks the app until acknowledged. The FBA
  tool's own gate isn't in this repo, so this is a re-implementation
  matching the described posture, not a direct code reuse.
- **Lightweight participant picker** (`src/components/ParticipantPicker.tsx`)
  — NOT the full Participant Profile module's UI (that module ships
  headless). Creates real `Participant` records (all fields present,
  sensible defaults) via a minimal form (age, cultural constraints,
  interests, communication mode) so downstream eligibility/personalisation
  logic behaves exactly as it would against a fully-authored profile.
- **Strategy browser** (`src/components/StrategyBrowser.tsx`) — category
  multi-select + evidence-tier filter; Responsive strategies live in a
  separate tab, never mixed into the category filter, with an escalation-
  phase selector that's informational only (never filters or ranks).
- **Superseded banner** (`src/components/SupersededBanner.tsx`) — hard UI
  rule from the brief: a superseded figure is never shown without the
  newer result shown alongside or instead of it.
- **Template detail** (`TemplateDetail.tsx`) — full template detail
  including the fixed `mechanism` (what personalisation must hold
  constant) and personalisation-axis data-availability indicators (green
  dot = participant has real data for that axis).
- **Personalisation wizard** (`PersonalisationWizard.tsx`) — the two/
  three-step flow from the Personalization Architecture brief:
  1. **Capacity adaptation note** — free text, practitioner judgement,
     never sent to the model.
  2. **AI-assisted personalisation** (only offered when the strategy
     declares axes the active participant has real data for) — one
     bounded call to `strategy-library-server`, via `src/lib/api.ts`.
     Mechanism + citation are always shown alongside the result, never
     the result alone. Three distinct outcomes: success (pre-fills the
     editable activity field), refusal (fixed reassuring copy, nothing
     lost), or genuine failure (fixed generic copy, nothing lost) — see
     `src/lib/personalisationDraft.ts` for the localStorage draft that
     survives either failure or a page reload mid-flow.
  3. **Manual entry** — always available, with or without having tried
     the AI step first. The system never pre-fills `personalisedActivity`/
     `rationale` on save; the generated text is only ever a starting
     point in an editable field, reviewed before saving (the practitioner
     review gate).
  A one-click "Plan format" / "Session-log format" toggle re-derives the
  displayed text from the same generation result client-side
  (`src/lib/reformat.ts`) — never a second API call.
- **Records + export** (`RecordsList.tsx`, `ExportView.tsx`) — per-
  participant record list with a version-drift indicator, and plan-ready
  export (copy to clipboard / download .txt) via `assembleExportText`.

## Storage

Browser-local via Dexie (IndexedDB) — see `src/lib/db.ts`. The suite's
"SQLite/Dexie for local-only pieces" note means Dexie here: the
better-sqlite3-backed repositories from `@fracta-flow/participant-profile`
and `@fracta-flow/strategy-library` are Node-only (native addon) and can't
run in a browser. This app persists the exact same `Participant` and
`PersonalisationRecord` shapes via Dexie instead — same types, different
backend.

`StrategyTemplate`/`StrategySource` seed content is not stored in Dexie —
it's read directly from the bundled `SEED_TEMPLATES`/`SEED_SOURCES`
(read-only in this app, matching the "centrally-hosted, practitioners get
read access" hosting model).

**Known limitation:** this app's `Participant` records are local to the
browser and independent of any records created via the headless
`@fracta-flow/participant-profile` SQLite module — there's no sync
between the two storage backends yet.

## The `useLiveQuery` bug, guarded against

The brief flags a known FBA tool bug: `dexie-react-hooks`' `useLiveQuery`
returns `undefined` while the initial query is loading, with no way to
distinguish that from "resolved to nothing" by return value alone — the
FBA tool treated `undefined` as "no records" and hung blank on first
launch. `ParticipantPicker.tsx`, `RecordsList.tsx`, and `App.tsx` all
check `=== undefined` explicitly before checking `.length === 0`.

## Why `vite.config.ts` has a `resolve.alias`

`@fracta-flow/participant-profile/core` and `@fracta-flow/strategy-library/core`
are aliased straight to their TypeScript source rather than resolved via
`node_modules` to the compiled `dist/core.js`. Both packages' `dist/` is
CommonJS (needed for their Node consumers — vitest, and the
better-sqlite3-backed repositories at the package root). Rollup's CJS
interop could not reliably resolve named exports re-exported through that
compiled output when building this app for production — it manifested
first as "X is not exported by core.js" build failures, and even after
working around that, left a literal unresolved `require("./types")` in
the shipped bundle (a `ReferenceError` at runtime, since browsers have no
`require`). Aliasing to source sidesteps CJS interop entirely: esbuild/
Rollup see real ESM `import`/`export` syntax and bundle it cleanly. See
the comment in `vite.config.ts` for the full explanation.

## Server-side personalisation calls only

`src/lib/api.ts` is the only place this app talks to a backend, and it
talks to `@fracta-flow/strategy-library-server` (`VITE_API_BASE_URL`,
default `http://localhost:8787`) — never to Anthropic directly, and the
app never holds an API key. See that package's README for why (a POC
that called the API client-side exposed usage in devtools and had no way
to log/rate-limit/audit).

## Development

```bash
npm install              # from the repo root
cp .env.example .env      # optional — only if VITE_API_BASE_URL isn't the default
npm run dev --workspace=@fracta-flow/strategy-library-app
npm run dev --workspace=@fracta-flow/strategy-library-server   # in another terminal
npm run build --workspace=@fracta-flow/strategy-library-app
npm run preview --workspace=@fracta-flow/strategy-library-app
```

The build was smoke-tested end-to-end in a real (headless) browser, twice:
1. Full golden path with no backend involved: consent → create participant
   → filter by category → open a superseded template (banner renders) →
   view My records → export to plan-ready text.
2. Full personalisation flow against a **real, running**
   `strategy-library-server` (with an intentionally invalid API key, to
   exercise the failure path without needing real credentials): open a
   strategy with declared axes → mechanism shown alongside → trigger
   "Personalise with AI" → genuine Anthropic 401 comes back, server
   classifies it as `api_error`, client shows the fixed "Something went
   wrong on our end" copy → capacity-adaptation note and typed state
   confirmed still present → manual save still succeeds afterwards.
Both runs: zero console/runtime errors.

## Explicitly excluded from this pass

Same Phase 1 exclusions as `@fracta-flow/strategy-library` (no
`FunctionHypothesis`/function-tagging at any phase, no multi-practitioner
review workflow, no ranking/recommended-for-this-case logic — the
eligibility filter here is the same documented pass-through described in
that package's README, for the same reason).
