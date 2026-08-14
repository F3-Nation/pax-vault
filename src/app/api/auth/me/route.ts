/**
 * Current-session endpoint consumed by `AuthProvider` on every page load.
 *
 * Beyond identity, it hands the client the signed-in user's own PAX id and
 * home region so the navbar / landing page can offer "Your Stats" and
 * "Your Region" links. Those ids normally come straight off the signed session
 * cookie (stamped at sign-in). Sessions minted before that existed are
 * backfilled once here, then re-signed — preserving `iat` so the backfill
 * can't silently extend a session's lifetime.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { signSessionPayload, type SessionPayload } from "@/lib/auth/session";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/constants";
import { getPaxIdentityByEmail } from "@/lib/bq/pax";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let payload: SessionPayload = session;
  let backfilled = false;

  if (!session.paxLookedUp) {
    try {
      const identity = await getPaxIdentityByEmail(
        session.email,
        session.email,
      );
      payload = {
        ...session,
        ...(identity ? { paxId: identity.paxId } : {}),
        ...(identity?.homeRegionId != null
          ? { homeRegionId: identity.homeRegionId }
          : {}),
        paxLookedUp: true,
      };
      backfilled = true;
    } catch (err) {
      // Non-fatal: the session is still valid, the shortcuts just stay hidden
      // and the lookup is retried on the next request.
      console.error("PAX identity backfill failed", err);
    }
  }

  const response = NextResponse.json({
    user: {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      paxId: payload.paxId ?? null,
      homeRegionId: payload.homeRegionId ?? null,
    },
  });

  if (backfilled) {
    // Keep the original expiry — `iat` is unchanged, so only the remaining
    // window is granted to the refreshed cookie.
    const remaining =
      SESSION_COOKIE_MAX_AGE - (Math.floor(Date.now() / 1000) - payload.iat);
    if (remaining > 0) {
      response.cookies.set(SESSION_COOKIE_NAME, signSessionPayload(payload), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: remaining,
      });
    }
  }

  return response;
}
