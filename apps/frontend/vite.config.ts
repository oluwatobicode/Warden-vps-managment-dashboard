import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Read shared-types from its TypeScript source, not its CommonJS build:
      // Vite compiles TS itself, so a schema change shows up on save with no
      // rebuild and no `--force` restart. (The "use the build" rule is for Node:
      // api and worker. It doesn't apply to Vite.) tsconfig.app.json has the
      // matching `paths` entry so the editor's types come from the source too.
      "shared-types": fileURLToPath(new URL("../../packages/shared-types/src/index.ts", import.meta.url)),
    },
  },
});
