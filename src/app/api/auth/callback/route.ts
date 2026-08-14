import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeCodeForToken, getUserInfo } from "@/lib/auth/oauth";
import { isAuthorizedEmail } from "@/lib/auth/allowlist";
import { getPaxIdentityByEmail, type PaxIdentity } from "@/lib/bq/pax";
import { createSessionValue } from "@/lib/auth/session";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { getPublicOrigin } from "@/lib/auth/origin";

interface StatePayload {
  csrfToken: string;
  clientId: string;
  returnTo: string;
  timestamp: number;
}

function errorRedirect(baseUrl: string, error: string, returnTo?: string) {
  const url = new URL("/", baseUrl);
  url.searchParams.set("error", error);
  if (returnTo) url.searchParams.set("redirect", returnTo);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const baseUrl = getPublicOrigin(request);

  if (errorParam) {
    return errorRedirect(baseUrl, errorParam);
  }

  if (!code || !stateParam) {
    return errorRedirect(baseUrl, "missing_params");
  }

  // Decode and validate state
  let state: StatePayload;
  try {
    state = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf-8"),
    ) as StatePayload;
  } catch {
    return errorRedirect(baseUrl, "invalid_state");
  }

  // Check timestamp (10 minute window)
  if (Date.now() - state.timestamp > 600_000) {
    return errorRedirect(baseUrl, "expired_state");
  }

  // Validate CSRF token against cookie
  const csrfCookie = request.cookies.get("oauth_csrf")?.value;
  if (!csrfCookie || csrfCookie !== state.csrfToken) {
    return errorRedirect(baseUrl, "csrf_mismatch");
  }

  const returnTo = state.returnTo || "/stats/nation";

  // Validate PKCE code verifier cookie
  const codeVerifier = request.cookies.get("oauth_code_verifier")?.value;
  if (!codeVerifier) {
    return errorRedirect(baseUrl, "missing_code_verifier", returnTo);
  }

  // Derive redirect URI from the actual request origin so it matches
  // what the login route sent to the auth server.
  const redirectUri = `${baseUrl}/api/auth/callback`;

  // Exchange code for tokens
  let accessToken: string;
  try {
    const tokens = await exchangeCodeForToken({
      code,
      codeVerifier,
      redirectUri,
    });
    accessToken = (tokens.access_token ?? tokens.accessToken) as string;
    if (!accessToken) {
      return errorRedirect(baseUrl, "token_exchange_failed", returnTo);
    }
  } catch (err) {
    console.error("Token exchange failed", err);
    return errorRedirect(baseUrl, "token_exchange_failed", returnTo);
  }

  // Fetch user info
  let userInfo: { sub: string; email: string; name?: string };
  try {
    userInfo = await getUserInfo(accessToken);
  } catch (err) {
    console.error("Failed to fetch user info", err);
    return errorRedirect(baseUrl, "userinfo_failed", returnTo);
  }

  // BQ allowlist check
  try {
    const allowed = await isAuthorizedEmail(userInfo.email);
    if (!allowed) {
      return errorRedirect(baseUrl, "not_authorized", returnTo);
    }
  } catch (err) {
    console.error("Allowlist check failed", err);
    return errorRedirect(baseUrl, "allowlist_error", returnTo);
  }

  // Resolve the signed-in user's own PAX record once, here: it decides the
  // post-login landing page AND gets stamped into the session so the
  // "Your Stats" / "Your Region" shortcuts need no further BigQuery calls.
  let identity: PaxIdentity | null = null;
  let identityResolved = false;
  try {
    identity = await getPaxIdentityByEmail(userInfo.email, userInfo.email);
    identityResolved = true;
  } catch (err) {
    // Leave the session unmarked so `/api/auth/me` can retry the lookup.
    console.error("PAX identity lookup failed, falling back to default", err);
  }

  // If no explicit returnTo was requested, redirect to the user's own PAX page
  let effectiveReturnTo = returnTo;
  if (returnTo === "/stats/nation" && identity) {
    effectiveReturnTo = `/stats/pax/${identity.paxId}`;
  }

  // Create HMAC session cookie
  const sessionValue = createSessionValue({
    sub: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    ...(identity ? { paxId: identity.paxId } : {}),
    ...(identity?.homeRegionId != null
      ? { homeRegionId: identity.homeRegionId }
      : {}),
    ...(identityResolved ? { paxLookedUp: true } : {}),
  });

  const response = NextResponse.redirect(
    new URL(effectiveReturnTo, baseUrl).toString(),
  );

  response.cookies.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  // Clear OAuth flow cookies
  const clearCookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  response.cookies.set("oauth_csrf", "", clearCookieOpts);
  response.cookies.set("oauth_code_verifier", "", clearCookieOpts);

  return response;
}
