export const DUCKDB_DATASETS = [
  "pv_pax",
  "pv_events",
  "pv_regions",
  "pv_areas",
  "pv_sectors",
  "pv_aos",
  "pv_upcoming",
  "pv_kotter",
] as const;

export type DuckDbDataset = (typeof DUCKDB_DATASETS)[number];
export const DUCKDB_CONTRACT_VERSION = "pv-release.v1";
export const DUCKDB_COMPATIBILITY_REGISTRY = {
  servingRevisions: [
    {
      id: "pax-vault-duckdb-phase1",
      pointerSchemaVersion: "pv-release.v1",
      releaseContractVersion: "pv-release.v1",
      datasetSchemaVersions: {
        pv_pax: "pv_pax.v1",
        pv_events: "pv_events.v1",
        pv_regions: "pv_regions.v1",
        pv_areas: "pv_areas.v1",
        pv_sectors: "pv_sectors.v1",
        pv_aos: "pv_aos.v1",
        pv_upcoming: "pv_upcoming.v1",
        pv_kotter: "pv_kotter.v1",
      },
      rollbackEligible: true,
    },
  ],
} as const;

/**
 * Consumer-owned schema registry. Add a new version only with a coordinated
 * serving/rollback revision; unknown versions are never accepted implicitly.
 */
export const DUCKDB_SCHEMA_REGISTRY: Readonly<
  Record<DuckDbDataset, DuckDbSchemaSpec>
> = {
  pv_pax: schema("pv_pax", [
    ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
    ["user_id", "INTEGER", true],
    ["f3_name", "VARCHAR", true],
    ["home_region_id", "INTEGER", true],
    ["home_region_name", "VARCHAR", true],
    ["avatar_url", "VARCHAR", true],
    ["status", "VARCHAR", true],
    ["start_date_override", "VARCHAR", true],
    ["regions", "STRUCT(region_org_id INTEGER, region_name VARCHAR)[]", true],
    ["aos", "STRUCT(ao_org_id INTEGER, ao_name VARCHAR)[]", true],
    ["types", "STRUCT(type_id INTEGER, type_name VARCHAR)[]", true],
    ["tags", "STRUCT(tag_id INTEGER, tag_name VARCHAR)[]", true],
  ]),
  pv_events: schema("pv_events", [
    ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
    ["event_id", "INTEGER", true],
    ["event_date", "DATE", true],
    ["event_name", "VARCHAR", true],
    ["pax_count", "INTEGER", true],
    ["fng_count", "INTEGER", true],
    ["ao_org_id", "INTEGER", true],
    ["ao_name", "VARCHAR", true],
    ["region_org_id", "INTEGER", true],
    ["region_name", "VARCHAR", true],
    ["area_org_id", "INTEGER", true],
    ["area_name", "VARCHAR", true],
    ["territory_org_id", "INTEGER", true],
    ["territory_name", "VARCHAR", true],
    ["sector_org_id", "INTEGER", true],
    ["sector_name", "VARCHAR", true],
    ["first_f_ind", "INTEGER", true],
    ["second_f_ind", "INTEGER", true],
    ["third_f_ind", "INTEGER", true],
    [
      "types",
      'STRUCT(id INTEGER, "name" VARCHAR, description VARCHAR, event_category VARCHAR)[]',
      true,
    ],
    ["tags", 'STRUCT(id INTEGER, "name" VARCHAR, description VARCHAR)[]', true],
    [
      "attendance",
      "STRUCT(user_id INTEGER, f3_name VARCHAR, q_ind INTEGER, coq_ind INTEGER, avatar_url VARCHAR, attended BOOLEAN, ghost BOOLEAN, fartsack BOOLEAN)[]",
      true,
    ],
  ]),
  pv_regions: schema("pv_regions", [
    ["region_id", "INTEGER", true],
    ["region_name", "VARCHAR", true],
    ["area_id", "INTEGER", true],
    ["area_name", "VARCHAR", true],
    ["logo_url", "VARCHAR", true],
    ["is_active", "BOOLEAN", true],
    ["aos", "STRUCT(ao_org_id INTEGER, ao_name VARCHAR)[]", true],
    ["types", "STRUCT(type_id INTEGER, type_name VARCHAR)[]", true],
    ["tags", "STRUCT(tag_id INTEGER, tag_name VARCHAR)[]", true],
    ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
  ]),
  pv_areas: schema("pv_areas", [
    ["area_id", "INTEGER", true],
    ["area_name", "VARCHAR", true],
    ["sector_id", "INTEGER", true],
    ["sector_name", "VARCHAR", true],
    ["territory_id", "INTEGER", true],
    ["territory_name", "VARCHAR", true],
    ["logo_url", "VARCHAR", true],
    ["is_active", "BOOLEAN", true],
    [
      "regions",
      "STRUCT(region_id INTEGER, region_name VARCHAR, is_active BOOLEAN)[]",
      true,
    ],
  ]),
  pv_sectors: schema("pv_sectors", [
    ["sector_id", "INTEGER", true],
    ["sector_name", "VARCHAR", true],
    ["logo_url", "VARCHAR", true],
    ["is_active", "BOOLEAN", true],
    [
      "territories",
      "STRUCT(territory_id INTEGER, territory_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN)[]",
      true,
    ],
    [
      "areas",
      "STRUCT(area_id INTEGER, area_name VARCHAR, is_active BOOLEAN)[]",
      true,
    ],
  ]),
  pv_aos: schema("pv_aos", [
    ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
    ["ao_id", "INTEGER", true],
    ["ao_name", "VARCHAR", true],
    ["region_id", "INTEGER", true],
    ["region_name", "VARCHAR", true],
    ["logo_url", "VARCHAR", true],
    ["is_active", "BOOLEAN", true],
    ["types", "STRUCT(type_id INTEGER, type_name VARCHAR)[]", true],
    ["tags", "STRUCT(tag_id INTEGER, tag_name VARCHAR)[]", true],
  ]),
  pv_upcoming: schema("pv_upcoming", [
    ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
    ["start_date", "DATE", true],
    ["start_time", "VARCHAR", true],
    ["ao_name", "VARCHAR", true],
    ["ao_org_id", "INTEGER", true],
    ["region_org_id", "INTEGER", true],
    ["location_name", "VARCHAR", true],
    ["event_name", "VARCHAR", true],
    ["event_type", "VARCHAR", true],
    ["event_category", "VARCHAR", true],
    [
      "q_list",
      "STRUCT(user_id INTEGER, f3_name VARCHAR, avatar_url VARCHAR)[]",
      true,
    ],
  ]),
  pv_kotter: schema("pv_kotter", [
    ["user_id", "INTEGER", true],
    ["home_region_id", "INTEGER", true],
    ["f3_name", "VARCHAR", true],
    ["avatar_url", "VARCHAR", true],
    ["kotter_status", "VARCHAR", true],
    ["total_events", "INTEGER", true],
    ["first_event_date", "VARCHAR", true],
    ["days_since_last_event", "INTEGER", true],
    ["last_event_date", "VARCHAR", true],
    ["last_event_name", "VARCHAR", true],
    ["last_event_ao_name", "VARCHAR", true],
    ["last_event_ao_org_id", "INTEGER", true],
    [
      "bestie_list",
      "STRUCT(user_id INTEGER, f3_name VARCHAR, avatar_url VARCHAR, co_attendance_count INTEGER)[]",
      true,
    ],
  ]),
};

export interface DuckDbSchemaSpec {
  schemaVersion: `${DuckDbDataset}.v1`;
  columns: Readonly<Record<string, { logicalType: string; nullable: boolean }>>;
  rowCountPolicy: "nonNegative";
  verificationQueries: readonly string[];
  goldenSpecifications: readonly {
    name: string;
    query: string;
    canonicalization: "rows-json-v1";
  }[];
}

function schema(
  dataset: DuckDbDataset,
  columns: readonly [string, string, boolean][],
): DuckDbSchemaSpec {
  return {
    schemaVersion: `${dataset}.v1`,
    columns: Object.fromEntries(
      columns.map(([name, logicalType, nullable]) => [
        name,
        { logicalType, nullable },
      ]),
    ),
    rowCountPolicy: "nonNegative",
    verificationQueries: [`SELECT COUNT(*) AS row_count FROM ${dataset}`],
    goldenSpecifications: [
      {
        name: `${dataset}.basic`,
        query: `SELECT COUNT(*) AS row_count FROM ${dataset}`,
        canonicalization: "rows-json-v1",
      },
    ],
  };
}
