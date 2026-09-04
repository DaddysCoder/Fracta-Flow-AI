import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Resolve straight to TS source for these two workspace packages'
      // browser-safe "core" entry, instead of their compiled dist/core.js.
      // Their dist/ build is CommonJS (needed for Node consumers of the
      // package root, e.g. vitest and the better-sqlite3-backed
      // repositories) — Rollup's CJS interop cannot reliably resolve
      // named exports re-exported through that compiled output, and even
      // wrapping every re-export as a fresh local binding still left a
      // literal, unresolved `require("./types")` in the production
      // bundle (a ReferenceError at runtime, since browsers have no
      // `require`). Source is real ESM as far as esbuild/Rollup are
      // concerned, so aliasing straight to it sidesteps the interop
      // question entirely.
      {
        find: "@fracta-flow/participant-profile/core",
        replacement: path.resolve(dirname, "../participant-profile/src/core.ts"),
      },
      {
        find: "@fracta-flow/strategy-library/core",
        replacement: path.resolve(dirname, "../strategy-library/src/core.ts"),
      },
      {
        find: "@fracta-flow/evidence-layer/core",
        replacement: path.resolve(dirname, "../evidence-layer/src/core.ts"),
      },
      // evidence-layer's own source imports the BARE "@fracta-flow/retrieval-core"
      // specifier internally (see evidence-layer/src/ranking.ts etc. — package
      // source always uses the bare specifier, per this repo's convention;
      // "/core" is purely an app-side aliasing target, never referenced inside
      // another package's own source). Aliasing evidence-layer/core to source
      // above doesn't change what THAT source imports, so the bare specifier
      // needs its own alias here too, or retrieval-core's bundled dist/index.js
      // (which eagerly requires documents.js — mammoth/pdf-parse/node:fs, none
      // of which resolve in a browser bundle) gets pulled in transitively.
      // retrieval-core also publishes this as its own "/core" subpath export
      // for any future consumer that wants to ask for the subset explicitly.
      {
        find: "@fracta-flow/retrieval-core",
        replacement: path.resolve(dirname, "../retrieval-core/src/core.ts"),
      },
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Strategy Library",
        short_name: "Strategy Library",
        description: "Evidence-based PBS strategy browsing and personalisation, offline-capable.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        icons: [],
      },
      workbox: {
        // Local practitioner data lives in IndexedDB (Dexie), not in
        // network responses — this only needs to cache the app shell for
        // offline use, not any data.
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
});
