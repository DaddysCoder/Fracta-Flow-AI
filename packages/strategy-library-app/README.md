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
- **Template detail + personalisation form** (`TemplateDetail.tsx`,
  `PersonalisationForm.tsx`) — full template detail, personalisation-axis
  data-availability indicators (green dot = participant has real data for
  that axis), and the practitioner-authored personalisation form. The
  system never pre-fills `personalisedActivity`/`rationale`.
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

## Development

```bash
npm install              # from the repo root
npm run dev --workspace=@fracta-flow/strategy-library-app
npm run build --workspace=@fracta-flow/strategy-library-app
npm run preview --workspace=@fracta-flow/strategy-library-app
```

The build was smoke-tested end-to-end in a real (headless) browser:
consent → create participant → filter by category → open a superseded
template (banner renders) → personalise a strategy → view it under My
records → export to plan-ready text. No console/runtime errors.

## Explicitly excluded from this pass

Same Phase 1 exclusions as `@fracta-flow/strategy-library` (no
`FunctionHypothesis`/function-tagging at any phase, no multi-practitioner
review workflow, no ranking/recommended-for-this-case logic — the
eligibility filter here is the same documented pass-through described in
that package's README, for the same reason).
