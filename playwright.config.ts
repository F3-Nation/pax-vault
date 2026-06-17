import { defineConfig, devices } from "@playwright/test";

/**
 * Local-only smoke test (NOT wired into CI).
 *
 * CI lacks OAuth and BigQuery credentials, so the authenticated, data-backed
 * pages can't be exercised there. Run this locally instead:
 *
 *   1. npm run dev            # dev server on https://localhost:3001
 *   2. npx playwright install chromium   # one-time browser download
 *   3. npm run test:e2e
 *
 * Requires .env.local to provide SESSION_SECRET and SAMPLE_REGION.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional if the env is already populated.
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    ignoreHTTPSErrors: true, // dev server uses a self-signed cert
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
