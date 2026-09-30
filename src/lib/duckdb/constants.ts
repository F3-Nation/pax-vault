export const DUCKDB_DATASETS = [
  "pv_pax",
  "pv_events",
  "pv_regions",
  "pv_areas",
  "pv_sectors",
  "pv_aos",
  "pv_upcoming",
  "pv_kotter",
  "pv_territories",
] as const;

/** @deprecated Use DUCKDB_DATASETS; retained as a source-compatible alias. */
export const DUCKDB_V2_DATASETS = DUCKDB_DATASETS;
export type DuckDbDataset = (typeof DUCKDB_DATASETS)[number];
type DuckDbV1Dataset = Exclude<DuckDbDataset, "pv_territories">;
export type DuckDbContractVersion = "pv-release.v2";
export const DUCKDB_CONTRACT_VERSION = "pv-release.v2";
/** @deprecated Use DUCKDB_CONTRACT_VERSION. */
export const DUCKDB_V2_CONTRACT_VERSION = DUCKDB_CONTRACT_VERSION;
export const DUCKDB_SOURCE_READ_POLICY = "ordered-sequential-per-dataset";

/**
 * Consumer-owned schema registry. Add a new version only with a coordinated
 * serving/rollback revision; unknown versions are never accepted implicitly.
 */
const legacySchemaRegistry: Readonly<
  Record<DuckDbV1Dataset, DuckDbSchemaSpec>
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

// v2 adds two pax columns and six event-content columns; other v1-schema
// datasets retain exactly their previous column definitions.
const paxV2Columns = [
  ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
  ["user_id", "INTEGER", true],
  ["f3_name", "VARCHAR", true],
  ["home_region_id", "INTEGER", true],
  ["home_region_name", "VARCHAR", true],
  ["avatar_url", "VARCHAR", true],
  ["email", "VARCHAR", true],
  ["status", "VARCHAR", true],
  ["start_date_override", "VARCHAR", true],
  ["regions", "STRUCT(region_org_id INTEGER, region_name VARCHAR)[]", true],
  ["aos", "STRUCT(ao_org_id INTEGER, ao_name VARCHAR)[]", true],
  ["types", "STRUCT(type_id INTEGER, type_name VARCHAR)[]", true],
  ["tags", "STRUCT(tag_id INTEGER, tag_name VARCHAR)[]", true],
  [
    "roles",
    "STRUCT(role_id INTEGER, role_name VARCHAR, org_id INTEGER, org_name VARCHAR, org_type VARCHAR)[]",
    true,
  ],
] as const;
const eventsV2Columns = [
  ["refreshed_at", "TIMESTAMP WITH TIME ZONE", true],
  ["event_id", "INTEGER", true],
  ["event_date", "DATE", true],
  ["event_name", "VARCHAR", true],
  ["pax_count", "INTEGER", true],
  ["fng_count", "INTEGER", true],
  ["description", "VARCHAR", true],
  ["preblast", "VARCHAR", true],
  ["preblast_rich", "JSON", true],
  ["backblast", "VARCHAR", true],
  ["backblast_rich", "JSON", true],
  ["meta", "JSON", true],
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
] as const;

function orderedSchema(
  dataset: DuckDbDataset,
  version: "v1" | "v2",
  columns: readonly (readonly [string, string, boolean])[],
): DuckDbSchemaSpec {
  return {
    schemaVersion: `${dataset}.${version}`,
    columns: columns.map(([name, logicalType, nullable]) => ({
      name,
      logicalType,
      nullable,
    })),
    rowCountPolicy: "nonNegative",
    verificationQueries: [`SELECT COUNT(*) AS row_count FROM ${dataset}`],
    goldenSpecifications: [
      {
        name: "candidate_transport_check",
        query: `SELECT COUNT(*) AS row_count FROM ${dataset}`,
        canonicalization: "rows-json-v1",
      },
    ],
  };
}

function orderedV1Schema(
  dataset: DuckDbV1Dataset,
  version: "v1" | "v2" = "v1",
): DuckDbSchemaSpec {
  const columns = legacySchemaRegistry[dataset].columns;
  return orderedSchema(
    dataset,
    version,
    Object.entries(columns).map(([name, column]) => [
      name,
      column.logicalType,
      column.nullable,
    ]),
  );
}

/** Version-2 columns follow the producer's ordered array representation. */
export const DUCKDB_V2_SCHEMA_REGISTRY: Readonly<
  Record<DuckDbDataset, DuckDbSchemaSpec>
> = {
  pv_pax: orderedSchema("pv_pax", "v2", paxV2Columns),
  pv_events: orderedSchema("pv_events", "v2", eventsV2Columns),
  pv_regions: orderedV1Schema("pv_regions"),
  pv_areas: orderedV1Schema("pv_areas", "v2"),
  pv_sectors: orderedV1Schema("pv_sectors", "v2"),
  pv_aos: orderedV1Schema("pv_aos"),
  pv_upcoming: orderedV1Schema("pv_upcoming"),
  pv_kotter: orderedV1Schema("pv_kotter"),
  pv_territories: orderedSchema("pv_territories", "v1", [
    ["territory_id", "INTEGER", true],
    ["territory_name", "VARCHAR", true],
    ["sector_id", "INTEGER", true],
    ["sector_name", "VARCHAR", true],
    ["logo_url", "VARCHAR", true],
    ["is_active", "BOOLEAN", true],
    [
      "areas",
      "STRUCT(area_id INTEGER, area_name VARCHAR, is_active BOOLEAN)[]",
      true,
    ],
  ]),
};

/** Canonical schema registry for the sole supported release contract. */
export const DUCKDB_SCHEMA_REGISTRY = DUCKDB_V2_SCHEMA_REGISTRY;

export function datasetsFor(contractVersion: string): readonly DuckDbDataset[] {
  if (contractVersion === DUCKDB_CONTRACT_VERSION) return DUCKDB_DATASETS;
  throw new Error(`unsupported DuckDB contract version: ${contractVersion}`);
}

export function schemaFor(
  dataset: DuckDbDataset,
  contractVersion: string,
): DuckDbSchemaSpec {
  const datasets = datasetsFor(contractVersion);
  if (!(datasets as readonly string[]).includes(dataset))
    throw new Error(`${dataset} is not supported by ${contractVersion}`);
  return DUCKDB_SCHEMA_REGISTRY[dataset];
}

export interface DuckDbSchemaSpec {
  schemaVersion: `${DuckDbDataset}.v1` | `${DuckDbDataset}.v2`;
  columns:
    | Readonly<Record<string, { logicalType: string; nullable: boolean }>>
    | readonly { name: string; logicalType: string; nullable: boolean }[];
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
  columns: readonly (readonly [string, string, boolean])[],
  schemaVersion:
    | `${DuckDbDataset}.v1`
    | `${DuckDbDataset}.v2` = `${dataset}.v1`,
): DuckDbSchemaSpec {
  return {
    schemaVersion,
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
