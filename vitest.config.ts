import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // The pure, load-bearing core. The worker/controller are integration-tested
      // by Playwright, not unit-tested, so they are intentionally out of scope here.
      include: ["src/lib/dlms/**/*.ts", "src/lib/engine/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/**/index.ts", "src/lib/dlms/samples.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 78,
      },
    },
  },
});
