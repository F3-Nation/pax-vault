/**
 * Session-aware permission helpers for server components and API routes.
 *
 * Bridges the session cookie (`lib/auth/server.ts`) to the org role tables
 * (`lib/bq/permissions.ts`). Wrapped in React's `cache()` so a single request
 * that checks the same region more than once — e.g. a page that both gates a
 * button and loads preferences — costs one BigQuery round trip.
 *
 * These helpers propagate BigQuery failures rather than swallowing them: a
 * lookup that errors is not the same as "denied", and quietly collapsing the
 * two is what issue #60's fix got wrong (see the search-silent-failures
 * postmortem). Call sites decide whether that means a 500 or hidden chrome.
 */
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/server";
import {
  getRegionPermission,
  type RegionPermission,
} from "@/lib/bq/permissions";
import { getPaxIdentityByEmail } from "@/lib/bq/pax";

/** Permission result for a signed-out or unknown user. */
export function noRegionPermission(): RegionPermission {
  return { userId: null, isAdmin: false };
}

/**
 * Resolve the current session user's permission for a region.
 *
 * Returns a denied result when there is no session or the region id is
 * invalid. Throws if the BigQuery lookup itself fails.
 */
export const getRegionPermissionForSession = cache(
  async (regionId: number): Promise<RegionPermission> => {
    const user = await getSessionUser();
    if (!user) return noRegionPermission();
    if (!Number.isInteger(regionId) || regionId <= 0) {
      return noRegionPermission();
    }

    return getRegionPermission(user.email, regionId);
  },
);

/**
 * The signed-in user's own PAX id (`f3data.public.users.id`), or null.
 *
 * Fast path: the session cookie carries `paxId` when it was resolved at
 * sign-in (or backfilled by `/api/auth/me`). Sessions minted before that
 * field existed fall back to one BigQuery lookup by email. A session marked
 * `paxLookedUp` with no `paxId` is an authorized email with no PAX record —
 * that is a definitive null, not a reason to query again.
 *
 * Throws if the fallback lookup fails; null means "not resolvable", never
 * "lookup broke".
 */
export const getOwnPaxIdForSession = cache(async (): Promise<number | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  if (typeof user.paxId === "number" && Number.isInteger(user.paxId)) {
    return user.paxId;
  }
  if (user.paxLookedUp) return null;

  const identity = await getPaxIdentityByEmail(user.email, user.email);
  return identity?.paxId ?? null;
});

/**
 * True when the session user IS the PAX with this id — the gate for
 * owner-only surfaces such as the 8 Box. Pages use it to decide what to
 * render; the API routes re-run it as the real enforcement.
 */
export async function isOwnPax(paxId: number): Promise<boolean> {
  if (!Number.isInteger(paxId) || paxId <= 0) return false;
  return (await getOwnPaxIdForSession()) === paxId;
}
