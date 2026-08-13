/**
 * Browser-safe subset of this package: types, seed content, and pure
 * functions only, no `better-sqlite3` (a native Node addon that cannot
 * bundle for the browser). Consumed two ways:
 *  - Node/vitest: via this file's compiled `dist/core.js` (CommonJS).
 *  - Browser (strategy-library-app): the app's vite.config.ts aliases
 *    `@fracta-flow/strategy-library/core` straight to this TS source file
 *    rather than the compiled dist, because Rollup's CommonJS interop
 *    couldn't reliably resolve named exports re-exported through the
 *    compiled output.
 */
export * from "./types";
export { isEligible, filterEligibleTemplates } from "./eligibility";
export { assembleExportText } from "./exportText";
export { resolveCurrentTemplate } from "./supersede";
export { SEED_SOURCES } from "./seed/sources";
export { SEED_TEMPLATES } from "./seed/templates";
