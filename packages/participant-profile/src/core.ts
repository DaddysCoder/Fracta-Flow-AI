/**
 * Browser-safe subset of this package: types and pure functions only, no
 * `better-sqlite3` (a native Node addon that cannot bundle for the
 * browser). Consumed two ways:
 *  - Node/vitest: via this file's compiled `dist/core.js` (CommonJS).
 *  - Browser (strategy-library-app): the app's vite.config.ts aliases
 *    `@fracta-flow/participant-profile/core` straight to this TS source
 *    file rather than the compiled dist, because Rollup's CommonJS
 *    interop couldn't reliably resolve named exports re-exported through
 *    the compiled output — see the comment there for details.
 */
export * from "./types";
export {
  getEligibilityFilters,
  getPersonalisationContext,
  getBehaviourRelevanceTags,
} from "./strategyLibraryView";
export type {
  EligibilityFilters,
  PersonalisationContext,
  BehaviourRelevanceTag,
} from "./strategyLibraryView";
