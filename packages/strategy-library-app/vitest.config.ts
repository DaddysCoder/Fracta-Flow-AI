import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Same alias rationale as vite.config.ts — resolve these two workspace
  // packages' browser-safe "core" entry straight from source so Vitest
  // (which shares Vite/Rollup's module resolution) doesn't hit the same
  // CJS/ESM interop gap.
  resolve: {
    alias: [
      {
        find: "@fracta-flow/participant-profile/core",
        replacement: path.resolve(dirname, "../participant-profile/src/core.ts"),
      },
      {
        find: "@fracta-flow/strategy-library/core",
        replacement: path.resolve(dirname, "../strategy-library/src/core.ts"),
      },
      // See vite.config.ts for why this one's aliased to retrieval-core's
      // browser-safe subset rather than its full index.
      {
        find: "@fracta-flow/retrieval-core",
        replacement: path.resolve(dirname, "../retrieval-core/src/browser.ts"),
      },
      // See vite.config.ts for why this is aliased to source too.
      {
        find: "@fracta-flow/evidence-layer",
        replacement: path.resolve(dirname, "../evidence-layer/src/index.ts"),
      },
    ],
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
