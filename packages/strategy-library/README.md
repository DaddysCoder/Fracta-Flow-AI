# Strategy Library

A base of evidence-based PBS strategies a practitioner selects from and
personalises to an individual participant. **Not a strategy generator** —
the AI never invents a technique. Every `StrategyTemplate` entry is
authored/sourced from published evidence before it ever appears in the
library. Same "decision support, not diagnostic" posture as the sibling
FBA Screener product.

## Non-negotiable constraints

- No participant-identifying information is ever sent to any AI system —
  only de-identified profile attributes relevant to a strategy's declared
  personalisation axes.
- The system assembles; the practitioner authors. Strategy selection and
  personalisation are always practitioner acts, always reviewable/editable
  before saving.
- Every entry traces to a citation. No entry ships without a source.
- **No function-of-behaviour tagging on strategies, ever.** FBA tool
  `FunctionHypothesis` integration is deferred to Phase 5+, and even then,
  matching happens outside the strategy's own record — never by tagging
  the strategy itself with a function.

## Three entities, not one flat model

- **`StrategySource`** — a citation.
- **`StrategyTemplate`** — shared, versioned, centrally-hosted content.
  Not participant data. `version` increments on any content edit.
- **`PersonalisationRecord`** — local, participant-linked,
  practitioner-authored. Pins `templateVersionUsed` at creation so a later
  content correction to the template never silently rewrites what a
  practitioner already selected and is accountable for.

If personalisation lived inside the template, two practitioners couldn't
personalise the same technique differently, authorship couldn't be
tracked, and a content correction would silently rewrite what a
practitioner is accountable for. `templateVersionUsed` lets a practitioner
reconstruct exactly what the evidence said at the moment they made their
selection.

## Category scheme

Six proactive categories, multi-select: `environmental`, `community`,
`communication`, `regulating`, `health_wellbeing`, `learning`. A separate
`Responsive` category is tracked via `isResponsive: boolean` rather than a
seventh category value — see `TemplateFilter.isResponsive` in
`templateRepository.ts`. Responsive strategies must render in their own
UI section, never mixed into the category filter, and should scale against
escalation-cycle phase + participant safety/capacity, never applied
uniformly.

`Primary/Secondary Prevention` is a timing framing, not a category — it's
deliberately not carried forward as its own value. Three seed entries
(`primary-prevention-strategies`, `secondary-prevention-strategies`) still
need re-tagging into the six real categories; see the content-gap note in
`src/seed/templates.ts`.

## Evidence-conflict handling

- Two entries describing the same underlying package merge into one
  `StrategyTemplate` with `evidenceTier: "mixed_package_level"` — both
  findings are stated honestly rather than picking a side. See
  `differential-reinforcement` in the seed content.
- If a newer, better-powered study contradicts an older figure, use
  `supersededBy`. **Hard UI rule: a superseded figure must never be shown
  without the newer result shown alongside or instead of it.**
  `StrategyTemplateRepository.resolveCurrent(id)` follows the chain to the
  current template for this purpose.

## Eligibility filtering — a deliberate pass-through

The brief calls for filtering the strategy list against a participant's
`age` and `culturalConstraints` (from the Participant Profile module)
*before* any strategy appears, as application logic — never an AI
decision, and never data passed to personalisation. That access-boundary
split (`getEligibilityFilters()` vs. `getPersonalisationContext()`) is
already enforced by `@fracta-flow/participant-profile`, and this package
consumes it rather than re-implementing participant access.

`StrategyTemplate` now carries `ageAppropriateness` and
`culturalSafetyFlag` (practitioner-authored, optional — see below), but
neither is wired into `isEligible()`. Both are guidance surfaced on the
template detail view, not a hard eligibility gate: there's no NDIS-defined
age bracket for PBS strategies to derive a real filter from, and turning a
partially-filled, free-text cultural note into silent exclusion logic
would smuggle in the "ranking / recommended-for-this-case logic" Phase 1
explicitly excludes. `src/eligibility.ts`'s `isEligible()` stays a
documented pass-through. If hard age/culture exclusion is ever required,
that's a product decision to revisit deliberately — not something to back
into via these fields.

## Age appropriateness and cultural safety (practitioner-authored guidance)

Two optional fields on `StrategyTemplate`, added for the Fracta Flow
branding pass:

- `ageAppropriateness?: { minAge?, maxAge?, note? }` — guidance only,
  never a filter. Rendered as a note on the template detail view.
- `culturalSafetyFlag?: { hasConsiderations: boolean, note?: string }` —
  free text, no enum/taxonomy ("flag it, don't design it"). When
  `hasConsiderations` is true, rendered as a prominent callout; otherwise
  nothing extra is shown.

Both are left unset on all 15 seed entries — authoring real values is a
clinical-content decision, not a coding task, so nothing here is
backfilled or guessed.

## Seed content

15 entries paraphrase-extracted from three sources (Crates & Spicer 2012;
Hassiotis et al. 2018; Paulauskaite et al. 2019) — see
`src/seed/templates.ts` and `src/seed/sources.ts`. Re-tagged against the
v2 category scheme per the brief; `capacityConsiderations`,
`personalizationAxes`, and several narrative fields (`prerequisites`,
`contraindications`, `safetyBoundary`, `measurementGuidance`,
`deliveryFormat`) were not supplied with the seed data and are left
empty rather than invented — that's separate follow-up content work.

Known content gaps carried from the brief: zero seed entries yet for
Regulating, Community, or Health and Wellbeing; seed content skews
intellectual disability/ABI rather than autism breadth.

## Export

`assembleExportText(record, template, sources)` assembles a
`PersonalisationRecord` plus its pinned `StrategyTemplate` and sources
into plan-ready text — matching the FBA tool's `DocumentationExport`
pattern (assembles, never generates). It surfaces a drift warning if the
template's current version has moved past what the record was authored
against, and always includes the `safetyBoundary` when one is set.

## Hosting model

`StrategyTemplate`/`StrategySource` are centrally-owned/hosted published
content — practitioners get read access to browse a local cache, seeded
from `src/seed/` on every `openDatabase()` call (upserted, never
downgrading a locally-ahead version). `PersonalisationRecord`s are
practitioner-local data, same privacy posture as the FBA tool and the
Participant Profile module.

## Usage

```ts
import {
  openDatabase,
  StrategyTemplateRepository,
  PersonalisationRecordRepository,
  filterEligibleTemplates,
  assembleExportText,
} from "@fracta-flow/strategy-library";
import { getEligibilityFilters } from "@fracta-flow/participant-profile";

const db = openDatabase("./data/strategy-library.db");
const templates = new StrategyTemplateRepository(db);
const records = new PersonalisationRecordRepository(db);

const eligibility = getEligibilityFilters(participant); // from participant-profile
const browsable = filterEligibleTemplates(
  templates.list({ categories: ["learning"], isResponsive: false }),
  eligibility
);

const record = records.create({
  strategyTemplateId: "visual-scheduling",
  templateVersionUsed: templates.get("visual-scheduling")!.version,
  participantRef: participant.id,
  personalisedActivity: "Use a picture schedule with the participant's preferred train images.",
  rationale: "Participant's interests include trains; supports predictability during transitions.",
  authoredBy: "practitioner-1",
  status: "draft",
});

const templateWithSources = templates.getWithSources(record.strategyTemplateId)!;
const planText = assembleExportText(record, templateWithSources, templateWithSources.sources);
```

## Development

```bash
npm install   # from the repo root
npm run build --workspace=@fracta-flow/strategy-library
npm test --workspace=@fracta-flow/strategy-library
```

## Explicitly excluded from Phase 1

- `FunctionHypothesis` matching from the FBA tool (Phase 5+)
- Any function-based tagging of strategies, at any phase
- Multi-practitioner content contribution/review workflow
- Any ranking or "recommended for this case" logic beyond static
  category/filter browsing (including the eligibility gap above)
