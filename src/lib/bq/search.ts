import { queryBigQuery } from "@/lib/db";
import { RegionInfo, AOInfo, PAXInfo } from "@/lib/types";
import { getDuckDbRuntime } from "@/lib/duckdb/factory";
import { DuckDbQueryAdapter, selectDuckDbOrLegacy } from "@/lib/duckdb/query";

export type SearchAllResult = {
  regions: RegionInfo[];
  aos: AOInfo[];
  pax: PAXInfo[];
};

type SearchAllRow = {
  regions: RegionInfo[] | null;
  aos: AOInfo[] | null;
  pax: PAXInfo[] | null;
};

export async function searchAll(
  q: string,
  userIdentifier?: string,
  includeInactive = false,
): Promise<SearchAllResult> {
  const term = (q || "").trim();
  if (term.length < 2) return { regions: [], aos: [], pax: [] };

  return selectDuckDbOrLegacy({
    capability: "search",
    env: process.env,
    duckdb: async () => {
      const likePattern = `%${term.toLowerCase()}%`;
      const activeFilter = includeInactive ? "" : "AND is_active = TRUE";
      const rows = await new DuckDbQueryAdapter(
        getDuckDbRuntime(),
      ).execute<SearchAllRow>(
        `SELECT
        (SELECT COALESCE(list(item), []) FROM (
          SELECT struct_pack(region_id := region_id, region_name := region_name,
            logo_url := logo_url, is_active := is_active) AS item
          FROM pv_regions
          WHERE region_name IS NOT NULL AND LOWER(region_name) LIKE ? ${activeFilter}
          ORDER BY region_name LIMIT 50
        )) AS regions,
        (SELECT COALESCE(list(item), []) FROM (
          SELECT struct_pack(ao_id := ao_id, ao_name := ao_name,
            region_id := region_id, region_name := region_name,
            logo_url := logo_url, is_active := is_active) AS item
          FROM pv_aos
          WHERE ao_name IS NOT NULL AND LOWER(ao_name) LIKE ? ${activeFilter}
          ORDER BY ao_name LIMIT 50
        )) AS aos,
        (SELECT COALESCE(list(item), []) FROM (
          SELECT struct_pack(user_id := user_id, f3_name := f3_name,
            home_region_id := home_region_id, home_region_name := home_region_name,
            avatar_url := avatar_url, status := status) AS item
          FROM pv_pax
          WHERE f3_name IS NOT NULL AND LOWER(f3_name) LIKE ?
          ORDER BY f3_name LIMIT 50
        )) AS pax`,
        [likePattern, likePattern, likePattern],
      );
      const row = rows[0];
      return {
        regions: row?.regions ?? [],
        aos: row?.aos ?? [],
        pax: row?.pax ?? [],
      };
    },
    legacy: async () => {
      // Bound as a query parameter (@term) — no manual escaping needed.
      const likePattern = `%${term.toLowerCase()}%`;
      const activeFilter = includeInactive ? "" : "AND is_active = TRUE";

      // Single query — each subquery returns an ARRAY of STRUCTs so the entire
      // result comes back as one BigQuery row with three array columns.
      // ARRAY_AGG returns NULL when no rows match; we coalesce to [] in JS below.
      const query = `-- UNIFIED SEARCH
    SELECT
      (
        SELECT ARRAY_AGG(STRUCT(region_id, region_name, logo_url, is_active)
               ORDER BY region_name LIMIT 50)
        FROM pv_regions
        WHERE region_name IS NOT NULL
          AND LOWER(region_name) LIKE @term
          ${activeFilter}
      ) AS regions,
      (
        SELECT ARRAY_AGG(STRUCT(ao_id, ao_name, region_id, region_name, logo_url, is_active)
               ORDER BY ao_name LIMIT 50)
        FROM pv_aos
        WHERE ao_name IS NOT NULL
          AND LOWER(ao_name) LIKE @term
          ${activeFilter}
      ) AS aos,
      (
        SELECT ARRAY_AGG(STRUCT(user_id, f3_name, home_region_id, home_region_name, avatar_url, status)
               ORDER BY f3_name LIMIT 50)
        FROM pv_pax
        WHERE f3_name IS NOT NULL
          AND LOWER(f3_name) LIKE @term
      ) AS pax
  `;

      const rows = await queryBigQuery<SearchAllRow>(
        query,
        userIdentifier,
        `unified search: ${q}`,
        { term: likePattern },
      );

      const row = rows[0];
      return {
        regions: row?.regions ?? [],
        aos: row?.aos ?? [],
        pax: row?.pax ?? [],
      };
    },
  });
}
