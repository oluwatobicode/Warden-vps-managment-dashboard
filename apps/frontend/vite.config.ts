import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // shared-types is a linked workspace package built as CommonJS (repo rule).
  // Vite only converts CJS to ESM for packages it pre-bundles, and it skips
  // linked ones by default, so without this the browser gets raw `exports.x`.
  optimizeDeps: { include: ["shared-types"] },
});
