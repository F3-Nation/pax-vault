/**
 * 8 Box persistence.
 *
 * Backed by `paxVault.pv_pax_eight_box` (see scripts/sql/pv_pax_eight_box.sql).
 * Each PAX has at most one editable `draft` row and any number of immutable
 * `published` rows, each with a per-PAX `version` number.
 *
 * Deliberately NOT wrapped in `cacheStatsData`: like region preferences, this
 * is hand-edited data and the editor must see their own write on the very
 * next render. Every read here is a point lookup on a clustered column, so
 * it is cheap enough to run uncached.
 *
 * Writes are DML through the shared `queryBigQuery()` helper, fully
 * parameterized. The service account needs a table-level dataEditor grant —
 * until then, writes surface as the 503 from `isWritePermissionError()`.
 */
import { queryBigQuery } from "@/lib/db";
import { normalizeDeep } from "@/lib/normalize";
import {
  parseEightBoxContent,
  serializeEightBoxContent,
  type EightBoxContent,
  type EightBoxStatus,
} from "@/lib/eightBox";

// Unqualified: `queryBigQuery` binds `paxVault` as the default dataset.
const EIGHT_BOX_TABLE = "pv_pax_eight_box";

/** Enough of the PAX record to title and decorate the 8 Box pages. */
export interface EightBoxOwnerInfo {
  user_id: number;
  f3_name: string;
  avatar_url: string | null;
  home_region_id: number | null;
  home_region_name: string | null;
}

export interface EightBoxRecord {
  id: string;
  paxId: number;
  status: EightBoxStatus;
  /** Per-PAX sequence assigned at publish; null while a draft. */
  version: number | null;
  period: string;
  content: EightBoxContent;
  /** ISO timestamp while the share link is on; null otherwise. */
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface EightBoxPageData {
  /** Null when the pax id matches no PAX record. */
  info: EightBoxOwnerInfo | null;
  /** The in-progress draft, if any. */
  draft: EightBoxRecord | null;
  /** Published versions, newest first. */
  versions: EightBoxRecord[];
}

/** Raw row shape as selected below (timestamps cast to STRING). */
interface RawRecord {
  id: string;
  pax_id: number;
  status: string;
  version: number | null;
  period: string;
  json_content: string | null;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface RawInfo {
  user_id: number;
  f3_name: string;
  avatar_url: string | null;
  home_region_id: number | null;
  home_region_name: string | null;
}

/**
 * Column list reused by both reads so the two row shapes never drift.
 * Timestamps are formatted as ISO-8601 (UTC) so `new Date()` parses them
 * unambiguously on the client; a NULL timestamp formats to NULL.
 */
const ISO = "'%Y-%m-%dT%H:%M:%E3SZ'";
const RECORD_COLUMNS = `
  id,
  pax_id,
  status,
  version,
  period,
  json_content,
  FORMAT_TIMESTAMP(${ISO}, shared_at) AS shared_at,
  FORMAT_TIMESTAMP(${ISO}, created_at) AS created_at,
  FORMAT_TIMESTAMP(${ISO}, updated_at) AS updated_at,
  FORMAT_TIMESTAMP(${ISO}, published_at) AS published_at
`;

function toRecord(raw: RawRecord): EightBoxRecord {
  return {
    id: raw.id,
    paxId: Number(raw.pax_id),
    status: raw.status === "published" ? "published" : "draft",
    version: raw.version == null ? null : Number(raw.version),
    period: raw.period ?? "",
    content: parseEightBoxContent(raw.json_content),
    sharedAt: raw.shared_at ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    publishedAt: raw.published_at ?? null,
  };
}

function toInfo(raw: RawInfo | null | undefined): EightBoxOwnerInfo | null {
  if (!raw || raw.user_id == null) return null;
  return {
    user_id: Number(raw.user_id),
    f3_name: raw.f3_name,
    avatar_url: raw.avatar_url ?? null,
    home_region_id:
      raw.home_region_id == null ? null : Number(raw.home_region_id),
    home_region_name: raw.home_region_name ?? null,
  };
}

/**
 * Everything the owner's 8 Box pages need, in one query: the PAX record plus
 * every draft/published row for that PAX.
 */
export async function getEightBoxPageData(
  paxId: number,
  userIdentifier?: string,
): Promise<EightBoxPageData> {
  const query = `-- EIGHT BOX PAGE READ
    WITH
      pax_info AS (
        SELECT user_id, f3_name, avatar_url, home_region_id, home_region_name
        FROM pv_pax
        WHERE user_id = @paxId
        LIMIT 1
      ),
      rows_for_pax AS (
        SELECT ${RECORD_COLUMNS}
        FROM ${EIGHT_BOX_TABLE}
        WHERE pax_id = @paxId
      )
    SELECT
      (SELECT AS STRUCT * FROM pax_info) AS info,
      ARRAY(
        SELECT AS STRUCT *
        FROM rows_for_pax
        ORDER BY published_at DESC, version DESC, updated_at DESC
      ) AS records
  `;

  const results = await queryBigQuery<{
    info: RawInfo | null;
    records: RawRecord[] | null;
  }>(query, userIdentifier, `fetch 8 box for pax ${paxId}`, { paxId });

  const row = normalizeDeep<{
    info: RawInfo | null;
    records: RawRecord[] | null;
  } | null>(results?.[0] ?? null);

  const records = (row?.records ?? []).map(toRecord);

  return {
    info: toInfo(row?.info),
    // If a race ever produced two drafts, surface the most recently updated
    // one; the next save MERGEs into whichever matches first.
    draft:
      records
        .filter((r) => r.status === "draft")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null,
    versions: records.filter((r) => r.status === "published"),
  };
}

export interface EightBoxVersionPageData {
  info: EightBoxOwnerInfo | null;
  /** Null when no row has this id for this PAX (draft or published). */
  record: EightBoxRecord | null;
}

/** One row by id, scoped to the PAX so an id can never cross owners. */
export async function getEightBoxVersionPageData(
  paxId: number,
  versionId: string,
  userIdentifier?: string,
): Promise<EightBoxVersionPageData> {
  const query = `-- EIGHT BOX VERSION READ
    WITH
      pax_info AS (
        SELECT user_id, f3_name, avatar_url, home_region_id, home_region_name
        FROM pv_pax
        WHERE user_id = @paxId
        LIMIT 1
      ),
      the_row AS (
        SELECT ${RECORD_COLUMNS}
        FROM ${EIGHT_BOX_TABLE}
        WHERE pax_id = @paxId AND id = @versionId
        LIMIT 1
      )
    SELECT
      (SELECT AS STRUCT * FROM pax_info) AS info,
      (SELECT AS STRUCT * FROM the_row) AS record
  `;

  const results = await queryBigQuery<{
    info: RawInfo | null;
    record: RawRecord | null;
  }>(query, userIdentifier, `fetch 8 box version for pax ${paxId}`, {
    paxId,
    versionId,
  });

  const row = normalizeDeep<{
    info: RawInfo | null;
    record: RawRecord | null;
  } | null>(results?.[0] ?? null);

  return {
    info: toInfo(row?.info),
    record: row?.record ? toRecord(row.record) : null,
  };
}

export interface EightBoxWrite {
  /**
   * Row id. For a MERGE that matches the existing draft this is ignored; when
   * no draft exists it becomes the new row's id. Callers mint it with
   * `crypto.randomUUID()` so the id is known without a re-read.
   */
  id: string;
  paxId: number;
  period: string;
  content: EightBoxContent;
}

/**
 * Upsert the PAX's single draft. Matches on (pax_id, status = 'draft'); a
 * match updates in place, otherwise a new draft row is inserted.
 */
export async function saveEightBoxDraft(
  write: EightBoxWrite,
  userIdentifier?: string,
): Promise<void> {
  const query = `-- EIGHT BOX DRAFT SAVE
    MERGE ${EIGHT_BOX_TABLE} T
    USING (
      SELECT
        @paxId AS pax_id,
        @id AS id,
        @period AS period,
        @jsonContent AS json_content
    ) S
    ON T.pax_id = S.pax_id AND T.status = 'draft'
    WHEN MATCHED THEN UPDATE SET
      period = S.period,
      json_content = S.json_content,
      updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      id, pax_id, status, version, period, json_content,
      shared_at, created_at, updated_at, published_at
    ) VALUES (
      S.id, S.pax_id, 'draft', NULL, S.period, S.json_content,
      NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), NULL
    )
  `;

  await queryBigQuery(
    query,
    userIdentifier,
    `save 8 box draft for pax ${write.paxId}`,
    {
      paxId: write.paxId,
      id: write.id,
      period: write.period,
      jsonContent: serializeEightBoxContent(write.content),
    },
  );
}

/**
 * Publish: the same MERGE shape as the draft save, but the row lands as
 * `published` with its version number. Saving and publishing in one
 * statement means "no draft yet, publish directly" and "publish the existing
 * draft" are the same path, and there is never a moment where both a draft
 * and its published copy exist.
 *
 * `version` is `max(published version) + 1`, read by the caller just before.
 * A double-submit race could assign the same number twice; the UUID `id` is
 * the real identity, so that is cosmetic.
 */
export async function publishEightBox(
  write: EightBoxWrite & { version: number },
  userIdentifier?: string,
): Promise<void> {
  const query = `-- EIGHT BOX PUBLISH
    MERGE ${EIGHT_BOX_TABLE} T
    USING (
      SELECT
        @paxId AS pax_id,
        @id AS id,
        @version AS version,
        @period AS period,
        @jsonContent AS json_content
    ) S
    ON T.pax_id = S.pax_id AND T.status = 'draft'
    WHEN MATCHED THEN UPDATE SET
      status = 'published',
      version = S.version,
      period = S.period,
      json_content = S.json_content,
      updated_at = CURRENT_TIMESTAMP(),
      published_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (
      id, pax_id, status, version, period, json_content,
      shared_at, created_at, updated_at, published_at
    ) VALUES (
      S.id, S.pax_id, 'published', S.version, S.period, S.json_content,
      NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
    )
  `;

  await queryBigQuery(
    query,
    userIdentifier,
    `publish 8 box v${write.version} for pax ${write.paxId}`,
    {
      paxId: write.paxId,
      id: write.id,
      version: write.version,
      period: write.period,
      jsonContent: serializeEightBoxContent(write.content),
    },
  );
}

/**
 * Hard-delete one row (a draft or a published version). Scoped to the PAX
 * so an id from another owner is a no-op. BigQuery time travel is the only
 * undo.
 */
export async function deleteEightBoxRecord(
  paxId: number,
  id: string,
  userIdentifier?: string,
): Promise<void> {
  const query = `-- EIGHT BOX DELETE
    DELETE FROM ${EIGHT_BOX_TABLE}
    WHERE pax_id = @paxId AND id = @id
  `;

  await queryBigQuery(query, userIdentifier, `delete 8 box for pax ${paxId}`, {
    paxId,
    id,
  });
}

/** Turn the share link for a published version on or off. */
export async function setEightBoxShared(
  paxId: number,
  id: string,
  shared: boolean,
  userIdentifier?: string,
): Promise<void> {
  const query = `-- EIGHT BOX SHARE TOGGLE
    UPDATE ${EIGHT_BOX_TABLE}
    SET shared_at = IF(@shared, CURRENT_TIMESTAMP(), NULL),
        updated_at = CURRENT_TIMESTAMP()
    WHERE pax_id = @paxId AND id = @id AND status = 'published'
  `;

  await queryBigQuery(
    query,
    userIdentifier,
    `set 8 box shared=${shared} for pax ${paxId}`,
    { paxId, id, shared },
  );
}
