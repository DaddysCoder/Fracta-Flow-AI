# Fracta Flow AI

Practitioner-owned, local-first PBS (Positive Behaviour Support) tooling.
This repo is an npm workspaces monorepo — each module ships as its own
package under `packages/`, designed to be used standalone or together.

## Packages

- [`packages/participant-profile`](packages/participant-profile/README.md) —
  non-clinical "who is this person" data (interests, communication,
  cognitive, physical, health, context, goals) used to personalise
  strategies. Enforces the eligibility-pre-filter vs. personalisation-input
  split that the rest of the suite depends on.
- [`packages/strategy-library`](packages/strategy-library/README.md) —
  evidence-based PBS strategy content (`StrategyTemplate`, sourced and
  cited) plus practitioner-authored, participant-linked
  `PersonalisationRecord`s. Reads eligibility/personalisation data from
  `participant-profile` rather than re-implementing participant access.
- [`packages/strategy-library-app`](packages/strategy-library-app/README.md) —
  the Phase 1 MVP UI: a Vite + React + TypeScript + Tailwind PWA for
  browsing/filtering strategies and authoring personalisation records,
  offline-capable via Dexie (IndexedDB) for local storage.

## Development

```bash
npm install
npm run build   # builds every package
npm test        # runs every package's test suite
```

Each package also has its own `build`/`test` scripts — see its README for
package-specific usage.
