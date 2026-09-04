/**
 * Browser-safe subset of retrieval-core's public surface.
 *
 * `./index.ts` re-exports the whole package, including `lib/documents.ts`
 * (docx/PDF ingestion via `mammoth`/`pdf-parse`, which transitively pulls
 * in `@napi-rs/canvas`'s prebuilt native `.node` binaries) and
 * `lib/security.ts` (`node:crypto`/`node:fs`). Both are exactly what a
 * server-side host needs and exactly what a browser bundle can't load — a
 * `.node` file has no browser equivalent, and Vite's dev-mode dependency
 * scanner (unlike Rollup's production tree-shaking) evaluates the whole
 * CJS module graph eagerly, so importing `./index.ts` from a browser
 * bundle fails outright rather than just bloating it.
 *
 * This file exists purely so a browser host (see
 * `strategy-library-app/vite.config.ts` and `vitest.config.ts`, which
 * alias the bare `@fracta-flow/retrieval-core` specifier to this file) can
 * pull in only the pure ranking/tokenizing logic `@fracta-flow/evidence-
 * layer` actually calls at query time — `rankCandidates` (ranking.ts) and
 * `baseTokens` (text-search.ts, used by evidence-layer's `classifyIntent`)
 * — plus their supporting types. Neither module imports anything beyond
 * plain TypeScript/JS.
 *
 * Not part of the package's published `main` entry — deliberately not
 * touching `ranking.ts`/`text-search.ts` themselves (or `index.ts`) keeps
 * the freeze-guarded retrieval surface exactly as benchmarked.
 */
export * from "./lib/types";
export * from "./lib/text-search";
export { rankCandidates } from "./lib/ranking";
export type { RetrievalCandidate } from "./lib/ranking";
