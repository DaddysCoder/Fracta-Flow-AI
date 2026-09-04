/**
 * Browser-safe re-export of this package's full surface. Unlike
 * participant-profile/strategy-library, evidence-layer has no native
 * (better-sqlite3) dependency to exclude — this file exists purely for
 * consistency with their `/core` convention, so strategy-library-app can
 * alias straight to TS source here too and sidestep the same Rollup
 * CJS-interop issue documented in strategy-library-app/vite.config.ts
 * (named exports re-exported through compiled CommonJS output don't
 * reliably resolve for Rollup's static analysis; source is real ESM as
 * far as esbuild/Rollup are concerned).
 */
export * from "./index";
