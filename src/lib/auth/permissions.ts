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
