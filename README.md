# Participant Profile Module

A standalone data module holding what's known about a participant as a
person — not their behaviour data, not clinical assessment data. This is
the shared "who is this person" record that the Strategy Library reads
from to personalise strategies. It ships as its own module first, but is
designed to later be read by other tools in the same product suite (e.g.
the FBA tool).

## Relationship to the FBA tool

- This module is **not** a replacement for the FBA tool's behaviour/episode
  tracking. The FBA tool owns all clinical behaviour data (ABC logs,
  screener results, triangulation, risk flags).
- It holds only a **lightweight, non-clinical pointer** to what behaviours
  are being worked on (`behavioursOfConcern`), so the Strategy Library can
  be context-aware without duplicating FBA data.
- If the FBA tool is present and has already captured behaviour data for a
  participant, that field could later be synced/read rather than
  re-entered — see [Open decision](#open-decision-not-resolved) below. For
  now it's a simple field the practitioner fills in directly.

## Architecture

- **Local-first storage.** A single SQLite file (`better-sqlite3`), owned
  by the practitioner — no network calls, no vendor hosting. Consistent
  with the FBA tool's existing architecture.
- **Free text over rigid categories** for interests and communication —
  this data needs to capture nuance a dropdown can't.
- **Culture and age are pre-filters, not personalisation inputs.** They
  gate whether a strategy is ever allowed to surface — the same tier as
  "don't show an adult-targeted resource to a child" — not a variable an
  AI personalisation step tunes content by. This split is enforced in code
  (not just convention) by `src/strategyLibraryView.ts`:
  - `getEligibilityFilters(participant)` returns only `age` and
    `culturalConstraints`, for upstream include/exclude filtering.
  - `getPersonalisationContext(participant)` returns everything safe to
    hand to a personalisation step, and deliberately omits
    `culturalConstraints`, `age`, and clinical behaviour detail.
  - `getBehaviourRelevanceTags(participant)` returns only the thin
    "this is relevant to what's being worked on" pointer — id, name,
    brief description, optional FBA record link. Nothing clinical.

  Consumers (like the Strategy Library) should use these accessors rather
  than reading `Participant` fields directly, so the pre-filter/
  personalisation boundary can't be crossed by accident.

- **`behavioursOfConcern` is intentionally thin.** No triggers, frequency,
  severity, or setting events. If a field starts wanting that kind of
  detail, it belongs in the FBA tool, not here.

## Data model

See [`src/types.ts`](src/types.ts) for the full `Participant` interface.
It matches the brief's shape (`interests`, `communication`, `cognitive`,
`physical`, `health`, `context`, `goals`, `behavioursOfConcern`), with
camelCase field names in code and snake_case columns in SQLite.

## Usage

```ts
import {
  openDatabase,
  ParticipantRepository,
  getEligibilityFilters,
  getPersonalisationContext,
  emptyInterests,
  emptyCommunication,
  emptyCognitive,
  emptyPhysical,
  emptyHealth,
  emptyContext,
} from "@fracta-flow/participant-profile";

const db = openDatabase("./data/participants.db");
const repo = new ParticipantRepository(db);

const participant = repo.create({
  age: 12,
  culturalConstraints: "No physical touch as part of any activity.",
  interests: { ...emptyInterests(), general: ["dinosaurs", "trains"] },
  communication: { ...emptyCommunication(), mode: "AAC" },
  cognitive: emptyCognitive(),
  physical: emptyPhysical(),
  health: emptyHealth(),
  context: emptyContext(),
  goals: ["Increase independent requesting"],
});

// Strategy Library integration:
const eligibility = getEligibilityFilters(participant);       // pre-filter only
const personalisation = getPersonalisationContext(participant); // safe to personalise with
```

## Development

```bash
npm install
npm run build   # compile TypeScript to dist/
npm test        # run the vitest suite
```

## Open decision (not resolved)

**Standalone vs. suite integration:** if a practitioner has both this
module and the FBA tool, should `behavioursOfConcern` eventually sync
automatically from FBA records rather than be manually re-entered here?
Not required for MVP — the manual field is what's built. Flagging for the
product owner to decide before any FBA integration work starts.
