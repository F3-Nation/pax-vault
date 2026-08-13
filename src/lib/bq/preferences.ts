/**
 * Region preferences persistence.
 *
 * Backed by `paxVault.pv_regions_preferences` (region_id, json_config,
 * updated_user_id, updated_at) — one row per region, upserted via MERGE.
 *
 * Deliberately NOT wrapped in `cacheStatsData`: unlike stats data, preferences
 * are edited by hand and the editor must see their own write on the very next
 * render. The read is a single-row point lookup, so it is cheap enough to run
 * uncached.
 */
import { queryBigQuery } from "@/lib/db";
import {
  parseRegionPreferences,
  serializeRegionPreferences,
  type RegionPreferences,
} from "@/lib/preferences";

// Unqualified: `queryBigQuery` binds `paxVault` as the default dataset, the
// same way pv_events / pv_regions are referenced elsewhere.
const PREFERENCES_TABLE = "pv_regions_preferences";

export interface RegionPreferencesRecord {
  /** Fully-populated preferences (defaults applied for anything unset). */
  preferences: RegionPreferences;
  /** False when the region has no stored row yet and defaults are in use. */
  exists: boolean;
  /** `public.users.id` of whoever last saved, or null when never saved. */
  updatedUserId: number | null;
  /** ISO timestamp of the last save, or null when never saved. */
  updatedAt: string | null;
}

/**
 * Load a region's stored preferences, falling back to defaults when the region
 * has no row yet (the common case — the table starts empty).
 */
export async function getRegionPreferences(
  regionId: number,
  userIdentifier?: string,
): Promise<RegionPreferencesRecord> {
  const query = `-- REGION PREFERENCES READ
    SELECT
      json_config,
      updated_user_id,
      CAST(updated_at AS STRING) AS updated_at
    FROM ${PREFERENCES_TABLE}
    WHERE region_id = @regionId
    LIMIT 1
  `;

  const results = await queryBigQuery<{
    json_config: string | null;
    updated_user_id: number | null;
    updated_at: string | null;
  }>(query, userIdentifier, `fetch preferences for region ${regionId}`, {
    regionId,
  });

  const row = results?.[0];

  return {
    preferences: parseRegionPreferences(row?.json_config),
    exists: !!row,
    updatedUserId: row?.updated_user_id ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

/**
 * Upsert a region's preferences.
 *
 * `updatedUserId` is the `public.users.id` resolved from the session email —
 * the column is REQUIRED, so callers must have a real id before saving.
 */
export async function saveRegionPreferences(
  regionId: number,
  preferences: RegionPreferences,
  updatedUserId: number,
  userIdentifier?: string,
): Promise<void> {
  const query = `-- REGION PREFERENCES WRITE
    MERGE ${PREFERENCES_TABLE} T
    USING (
      SELECT
        @regionId AS region_id,
        @jsonConfig AS json_config,
        @updatedUserId AS updated_user_id
    ) S
    ON T.region_id = S.region_id
    WHEN MATCHED THEN UPDATE SET
      json_config = S.json_config,
      updated_user_id = S.updated_user_id,
      updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      region_id, json_config, updated_user_id, updated_at
    ) VALUES (
      S.region_id, S.json_config, S.updated_user_id, CURRENT_TIMESTAMP()
    )
  `;

  await queryBigQuery(
    query,
    userIdentifier,
    `save preferences for region ${regionId}`,
    {
      regionId,
      jsonConfig: serializeRegionPreferences(preferences),
      updatedUserId,
    },
  );
}

/**
 * True when an error is BigQuery refusing the write for lack of IAM rights,
 * rather than a transient failure or a bad query.
 *
 * The `pax-vault-bigquery-prod` service account is read-only today, so until
 * it is granted `bigquery.dataEditor` (or at least `bigquery.tables.updateData`)
 * on `paxVault.pv_regions_preferences`, every save fails this way. Detecting it
 * lets the API return an actionable message instead of a generic 500.
 */
export function isWritePermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Access Denied") &&
    message.includes("bigquery.tables.updateData")
  );
}
