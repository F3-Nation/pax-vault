/**
 * Org-level permission lookups against the F3 Nation role tables.
 *
 * Roles live in `f3data.public.roles_x_users_x_org` (role_id, user_id, org_id).
 * `role_id = 3` is "admin" in `f3data.public.roles`, and the overwhelming
 * majority of admin grants are held against `org_type = 'region'` orgs — so for
 * a region page the org_id being checked *is* the region id.
 *
 * The session cookie only carries the user's email (see `lib/auth/session.ts`),
 * so every check first resolves email -> `f3data.public.users.id`.
 */
import { queryBigQuery } from "@/lib/db";

/** `f3data.public.roles.id` for the "admin" role. */
export const ADMIN_ROLE_ID = 3;

// Fully-qualified because these live in the `public` dataset, not the
// `paxVault` default dataset that `queryBigQuery` binds.
const USERS_TABLE = "`f3data.public.users`";
const ROLES_TABLE = "`f3data.public.roles_x_users_x_org`";

export interface RegionPermission {
  /**
   * `f3data.public.users.id` for the session email, or null when the email
   * matches no user row. Needed for `pv_regions_preferences.updated_user_id`.
   */
  userId: number | null;
  /** True when that user holds role_id 3 against this region's org_id. */
  isAdmin: boolean;
}

/**
 * Resolve the signed-in user's id and whether they can administer a region.
 *
 * The admin grant must be on the region's own org_id — admin rights on a
 * parent area/sector/nation deliberately do NOT cascade down to regions.
 *
 * Email is bound as a query parameter (@email). `regionId` is bound too, but
 * is validated as a positive integer by callers before it gets here.
 *
 * Duplicate user rows sharing one email are handled deterministically: if any
 * of them holds the admin role, that id wins; otherwise the lowest id is used.
 */
export async function getRegionPermission(
  email: string,
  regionId: number,
): Promise<RegionPermission> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !Number.isInteger(regionId) || regionId <= 0) {
    return { userId: null, isAdmin: false };
  }

  const query = `-- REGION ADMIN CHECK
    WITH
      matched_users AS (
        SELECT id
        FROM ${USERS_TABLE}
        WHERE email IS NOT NULL
          AND LOWER(email) = @email
      ),
      admin_users AS (
        SELECT mu.id
        FROM matched_users mu
        JOIN ${ROLES_TABLE} r
          ON r.user_id = mu.id
        WHERE r.org_id = @regionId
          AND r.role_id = @adminRoleId
      )
    SELECT
      COALESCE(
        (SELECT MIN(id) FROM admin_users),
        (SELECT MIN(id) FROM matched_users)
      ) AS user_id,
      (SELECT COUNT(1) FROM admin_users) > 0 AS is_admin
  `;

  const results = await queryBigQuery<{
    user_id: number | null;
    is_admin: boolean;
  }>(query, normalizedEmail, `region admin check for region ${regionId}`, {
    email: normalizedEmail,
    regionId,
    adminRoleId: ADMIN_ROLE_ID,
  });

  const row = results?.[0];
  return {
    userId: row?.user_id ?? null,
    isAdmin: row?.is_admin === true,
  };
}
