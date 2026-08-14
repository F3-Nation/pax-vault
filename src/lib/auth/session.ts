import { createHmac, timingSafeEqual } from "crypto";
import { SESSION_COOKIE_MAX_AGE } from "@/lib/auth/constants";

export interface SessionPayload {
  sub: string;
  email: string;
  name?: string;
  /**
   * The signed-in user's own PAX id, resolved at sign-in so the "Your Stats" /
   * "Your Region" shortcuts don't need a BigQuery round-trip per page load.
   * Optional: sessions minted before these fields existed won't have them, and
   * not every authorized email resolves to a PAX record.
   */
  paxId?: number;
  /** Home region of `paxId`, same caveats. */
  homeRegionId?: number;
  /**
   * True once the PAX lookup has run for this session — including when it came
   * back empty. Without it, an email with no PAX record would re-query
   * BigQuery on every page load for the life of the session.
   */
  paxLookedUp?: boolean;
  iat: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** Sign an already-complete payload, preserving its `iat`. */
export function signSessionPayload(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(json);
  return `${json}.${signature}`;
}

export function createSessionValue(
  payload: Omit<SessionPayload, "iat">,
): string {
  return signSessionPayload({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  });
}

export function verifySessionValue(cookie: string): SessionPayload | null {
  const dotIdx = cookie.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const json = cookie.slice(0, dotIdx);
  const signature = cookie.slice(dotIdx + 1);

  const expected = sign(json);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf-8"),
    ) as SessionPayload;

    const age = Math.floor(Date.now() / 1000) - payload.iat;
    if (age > SESSION_COOKIE_MAX_AGE) return null;

    return payload;
  } catch {
    return null;
  }
}
