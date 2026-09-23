/**
 * Org-level permission lookups against the F3 Nation role grants.
 *
 * Grants are read from `pv_pax.roles`, an ARRAY<STRUCT<role_id, role_name,
 * org_id, org_name, org_type>> that the "PaxVault PAX" scheduled query
 * (`scripts/sql/pv_pax.sql`) copies from `f3data.public.roles_x_users_x_org`
 * every 6 hours — so a granted or revoked role takes up to that long to land.
 * The array holds every grant unfiltered; the match happens here.
 * `role_id = 3` is "admin" in `f3data.public.roles`, and the overwhelming
 * majority of admin grants are held against `org_type = 'region'` orgs — so for
 * a region page the org_id being checked *is* the region id.
 *
 * The session cookie only carries the user's email (see `lib/auth/session.ts`),
 * so every check first resolves email -> `pv_pax.user_id`
 * (= `f3data.public.users.id`).
 */
import { queryBigQuery } from "@/lib/db";

/** `f3data.public.roles.id` for the "admin" role. */
export const ADMIN_ROLE_ID = 3;

export interface RegionPermission {
  /**
   * `f3data.public.users.id` for the session email, or null when the email
   * matches no pv_pax row. Needed for `pv_regions_preferences.updated_user_id`.
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
        SELECT
          user_id AS id,
          EXISTS (
            SELECT 1
            FROM UNNEST(roles) r
            WHERE r.org_id = @regionId
              AND r.role_id = @adminRoleId
          ) AS is_admin
        FROM pv_pax
        WHERE email IS NOT NULL
          AND LOWER(email) = @email
      )
    -- Aggregate with no GROUP BY: always exactly one row, NULL/FALSE when the
    -- email matches nobody.
    SELECT
      COALESCE(MIN(IF(is_admin, id, NULL)), MIN(id)) AS user_id,
      COALESCE(LOGICAL_OR(is_admin), FALSE) AS is_admin
    FROM matched_users
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
