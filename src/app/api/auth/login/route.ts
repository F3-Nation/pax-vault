import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { getOAuthConfig } from "@/lib/auth/oauth";

function isValidReturnTo(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export async function GET(request: NextRequest) {
  const returnTo =
    request.nextUrl.searchParams.get("returnTo") ?? "/stats/nation";
  const safeReturnTo = isValidReturnTo(returnTo) ? returnTo : "/stats/nation";

  const csrfToken = randomUUID();
  const { CLIENT_ID, AUTH_SERVER_URL, REDIRECT_URI } = getOAuthConfig();

  const state = Buffer.from(
    JSON.stringify({
      csrfToken,
      clientId: CLIENT_ID,
      returnTo: safeReturnTo,
      timestamp: Date.now(),
    }),
  ).toString("base64url");

  const authorizeUrl = new URL(`${AUTH_SERVER_URL}/api/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl.toString(), 302);

  response.cookies.set("oauth_csrf", csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
