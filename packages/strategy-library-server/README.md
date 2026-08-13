# Strategy Library Server

Backend for Strategy Library personalisation calls. The Anthropic API key
lives only here — the client (`strategy-library-app`) never calls the
model directly and never holds the key. This exists specifically because
a proof-of-concept called the API client-side, which exposed API usage in
devtools and gave no way to log, rate-limit, or audit calls.

## What it does — and doesn't

This is Step 3 only, from the Personalization Architecture brief. Strategy
selection (Step 1) and capacity-adaptation notes (Step 2) are practitioner
acts that never reach this service — only the bounded generation call
does.

`POST /api/personalize`

```jsonc
// Request
{
  "strategyTemplateId": "visual-scheduling",
  "axisData": {
    "interests": { "general": ["trains"], "strengths": [], "dislikes": [] }
  },
  "capacityAdaptationNote": "Needs larger print, low vision."
}
```

```jsonc
// Response (200) — success
{
  "outcome": "success",
  "personalisedActivity": "…",
  "keptFixedStatement": "…",
  "mechanism": "…",
  "safetyBoundary": null,
  "citations": ["Crates, N., & Spicer, M. (2012). …"]
}
// Response (200) — refusal
{ "outcome": "refusal" }
// Response (200) — network_error | api_error
{ "outcome": "network_error", "message": "…" }
```

The endpoint always returns 200 once the request itself is valid (known
template, at least one declared axis, at least one usable field) — the
`outcome` field carries the three-way result the brief requires the
client to distinguish. `network_error` and `api_error` are kept separate
internally (and in server-side logs) but the client collapses both to the
same generic "something went wrong" message; only `refusal` gets its own
client copy. See `src/anthropicClient.ts` for the classification logic
and `src/logger.ts` for what gets logged (never profile field values,
only the strategy id and which axes were requested).

## Defense in depth on axis data

The client is responsible for only ever sending de-identified field
values relevant to the strategy's declared axes (see
`@fracta-flow/strategy-library`'s `PersonalisationAxis` → Participant
Profile field mapping). This server does not trust that on faith:
`src/axisData.ts`'s `extractAllowedAxisData` re-derives the template's
declared axes from `SEED_TEMPLATES` (never from the request) and only
reads the specific whitelisted subfields for those axes — anything else
in the request body is silently dropped before it ever reaches the
prompt.

## The moderation-refusal problem (flagged, not solved here)

During demo testing, the consumer-tier API refused/failed on legitimate
clinical inputs (a stated aversion to a gender; an Aboriginal Australian
cultural background used as context). That's a moderation-tuning issue on
the API side, not something fixable in this codebase — per the brief,
before this ships as a real product it needs a direct conversation with
Anthropic about an enterprise API relationship or different moderation
configuration for clinical/professional use.

In the meantime this backend: never drops the practitioner's input on a
failed/refused call (it's stateless — nothing here holds or discards
client state either way, so there's nothing to lose); distinguishes
refusal from genuine failure in every response; and logs refusals
server-side (`logRefusal`, redacted — see above) so patterns can be
tracked and raised with Anthropic. The refusal classification itself
(`looksLikeContentPolicyRefusal` in `src/anthropicClient.ts`) is
explicitly a best-effort heuristic, documented as such in the code — the
primary signal is a `stop_reason: "refusal"` on an otherwise-successful
response, which is what newer Claude models use to decline without
throwing an HTTP error.

## What is NOT implemented here (flagged, not silently skipped)

- **Auth / per-practitioner or per-org rate limiting.** Nothing in this
  codebase yet has a practitioner/org identity concept to hang rate
  limits or audit trails off of — the brief's complaint about the POC
  ("no ability to rate-limit, audit calls per practitioner/org") is a
  real gap, but building that requires an auth system that doesn't exist
  in this repo yet. This is the natural next dependency, not something to
  fake here.
- **Persistence of personalisation results.** Per the brief, results are
  not persisted server-side beyond returning them to the practitioner —
  this service holds no database and writes nothing.

## Development

```bash
cp .env.example .env   # fill in a real ANTHROPIC_API_KEY
npm install             # from the repo root
npm run dev --workspace=@fracta-flow/strategy-library-server
npm run build --workspace=@fracta-flow/strategy-library-server
npm test --workspace=@fracta-flow/strategy-library-server
```
