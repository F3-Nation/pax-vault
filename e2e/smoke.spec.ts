import { test, expect, type BrowserContext } from "@playwright/test";
import { createHmac } from "crypto";

/**
 * Mint a `__session` cookie the same way src/lib/auth/session.ts does, so the
 * smoke test can exercise authenticated pages without driving real OAuth.
 * (Replicated here because Playwright does not resolve the app's "@/" alias.
 * Keep in sync with createSessionValue / SESSION_COOKIE_NAME.)
 */
function mintSessionValue(email: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required (load it from .env.local)");
  }
  const payload = {
    sub: email,
    email,
    name: "Smoke Test",
    iat: Math.floor(Date.now() / 1000),
  };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(json)
    .digest("base64url");
  return `${json}.${signature}`;
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "https://localhost:3001";
const SAMPLE_REGION = process.env.SAMPLE_REGION;

async function signIn(context: BrowserContext) {
  await context.addCookies([
    {
      name: "__session",
      value: mintSessionValue("smoke@pax-vault.test"),
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe("pax-vault smoke", () => {
  test("public landing page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/PAX Vault/i).first()).toBeVisible();
  });

  test("unauthenticated stats route redirects to landing", async ({ page }) => {
    await page.goto(`/stats/region/${SAMPLE_REGION ?? "1"}`);
    // Middleware bounces unauthenticated users back to "/".
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });

  test("authenticated region dashboard loads", async ({ page, context }) => {
    test.skip(!SAMPLE_REGION, "SAMPLE_REGION not set in .env.local");
    await signIn(context);
    await page.goto(`/stats/region/${SAMPLE_REGION}`);
    await expect(page).toHaveURL(new RegExp(`/stats/region/${SAMPLE_REGION}`));
    // Some dashboard chrome should render once the data resolves.
    await expect(page.getByText(/Summary|Leaders/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("authenticated search API returns a well-formed 200", async ({
    context,
  }) => {
    await signIn(context);
    const res = await context.request.get("/api/search?q=no");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("regions");
    expect(body).toHaveProperty("aos");
    expect(body).toHaveProperty("pax");
  });
});
