import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "public/**",
        "build/**",
        "coverage/**",
        "**/*.config.{js,ts,mjs}",
        "**/*.d.ts",
        "src/types/**",
        "src/lib/db.ts",
        "src/lib/cache/**",
        "src/lib/pax.ts",
        "src/lib/region.ts",
        "src/lib/event.ts",
        "src/lib/ao.ts",
        "src/lib/service-worker.tsx",
        "src/lib/theme-switcher.tsx",
        "src/app/**",
        "src/components/**",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
