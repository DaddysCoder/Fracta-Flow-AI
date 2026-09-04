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
      // @fracta-flow/evidence-layer's compiled dist imports the bare
      // "@fracta-flow/retrieval-core" specifier internally (ranking.ts,
      // candidateAdapter.ts, intent.ts), which by default resolves to
      // retrieval-core's full index.ts — server-only ingestion (mammoth/
      // pdf-parse, which pulls in @napi-rs/canvas's native .node binaries)
      // and node:crypto/node:fs security helpers neither browser bundling
      // nor Vite's dev-mode dependency scan can load. Aliasing the bare
      // specifier itself (not a subpath) redirects every resolution of it
      // across the whole bundle — including from inside evidence-layer's
      // own compiled output — to retrieval-core's browser-safe subset
      // (see retrieval-core/src/browser.ts), which exports exactly the
      // pure ranking/tokenizing functions evidence-layer actually calls at
      // query time and nothing that touches Node or native modules.
      {
        find: "@fracta-flow/retrieval-core",
        replacement: path.resolve(dirname, "../retrieval-core/src/browser.ts"),
      },
      // @fracta-flow/evidence-layer's own compiled dist/index.js is
      // CommonJS too, and hits the exact same interop gap the comment atop
      // ParticipantPicker.tsx describes — Rollup's production build wraps
      // it correctly via the commonjs plugin, but Vite dev's esbuild
      // dependency pre-bundling doesn't, and serves it to the browser as
      // if it were already ESM (`exports is not defined` at runtime).
      // Aliasing straight to its real ESM TypeScript source sidesteps the
      // interop question entirely, same as the two aliases above.
      {
        find: "@fracta-flow/evidence-layer",
        replacement: path.resolve(dirname, "../evidence-layer/src/index.ts"),
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
