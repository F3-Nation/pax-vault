import { test, expect, type BrowserContext } from "@playwright/test";
import { createHmac } from "crypto";

/**
 * Mint a `__session` cookie the same way src/lib/auth/session.ts does, so the
 * smoke test can exercise authenticated pages without driving real OAuth.
 * (Replicated here because Playwright does not resolve the app's "@/" alias.
 * Keep in sync with createSessionValue / SESSION_COOKIE_NAME.)
 */
function mintSessionValue(email: string, paxId?: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required (load it from .env.local)");
  }
  const payload = {
    sub: email,
    email,
    name: "Smoke Test",
    // Mirrors what the OAuth callback stamps: when a paxId is given the
    // session is "this PAX", otherwise it's an authorized email with no PAX
    // record (so owner-only surfaces like the 8 Box stay hidden).
    ...(paxId != null ? { paxId, paxLookedUp: true } : { paxLookedUp: true }),
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
const SAMPLE_PAX = process.env.SAMPLE_PAX
  ? Number(process.env.SAMPLE_PAX)
  : undefined;

async function signIn(context: BrowserContext, paxId?: number) {
  await context.addCookies([
    {
      name: "__session",
      value: mintSessionValue("smoke@pax-vault.test", paxId),
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

  // 8 Box: read-only checks of the owner gate. Never writes (no draft save,
  // publish, or delete) — these run against real BigQuery data.
  test("own 8 Box page renders for its owner", async ({ page, context }) => {
    test.skip(!SAMPLE_PAX, "SAMPLE_PAX not set in .env.local");
    await signIn(context, SAMPLE_PAX);
    await page.goto(`/stats/pax/${SAMPLE_PAX}/8box`);
    await expect(page.getByText(/8 Box/i).first()).toBeVisible({
      timeout: 15000,
    });
    // Either an existing board/history or the first-run empty state — both
    // are owner-only content; the "private" card must NOT appear.
    await expect(page.getByText(/This 8 Box is private/i)).toHaveCount(0);
  });

  test("someone else's 8 Box shows the private card", async ({
    page,
    context,
  }) => {
    test.skip(!SAMPLE_PAX, "SAMPLE_PAX not set in .env.local");
    await signIn(context); // authorized email, no PAX record
    await page.goto(`/stats/pax/${SAMPLE_PAX}/8box`);
    await expect(page.getByText(/This 8 Box is private/i)).toBeVisible({
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
