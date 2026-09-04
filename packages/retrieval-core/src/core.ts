/**
 * Browser-safe subset of this package: pure ranking/text-search/extraction
 * logic only — no `node:fs`, no `mammoth`/`pdf-parse` (document ingestion,
 * Node-only), no crypto-with-file-I/O. Consumed two ways, mirroring
 * participant-profile's and strategy-library's `/core` convention:
 *  - Node/vitest: via this file's compiled `dist/core.js` (CommonJS).
 *  - Browser (strategy-library-app, via @fracta-flow/evidence-layer):
 *    aliased straight to this TS source file rather than the compiled
 *    dist, because Rollup's CJS interop can't reliably resolve named
 *    exports re-exported through compiled output, and because the full
 *    package's `dist/index.js` eagerly requires `documents.js` (mammoth/
 *    pdf-parse/node:fs), none of which resolve in a browser bundle.
 */
export * from "./lib/types";
export * from "./lib/text-search";
export { rankCandidates } from "./lib/ranking";
export type { RetrievalCandidate } from "./lib/ranking";
export { excerptFor, buildExtractiveAnswer } from "./lib/retrieval";
