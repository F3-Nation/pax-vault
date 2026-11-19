import { describe, expect, it } from "vitest";
import {
  DUCKDB_DATASETS,
  DUCKDB_DETAILS_PROFILE_DATASETS,
  DUCKDB_DETAILS_SCHEMA_REGISTRY,
  DUCKDB_SCHEMA_REGISTRY,
  schemaFor,
} from "./constants";

describe("DuckDB supported schema profiles", () => {
  it("retains the ten-dataset profile and describes event details separately", () => {
    expect(DUCKDB_DATASETS).toHaveLength(10);
    expect(DUCKDB_DETAILS_PROFILE_DATASETS).toHaveLength(11);
    expect(DUCKDB_DETAILS_PROFILE_DATASETS).toContain("pv_event_details");
    expect(DUCKDB_SCHEMA_REGISTRY.pv_events.schemaVersion).toBe("pv_events.v2");
    const events = schemaFor("pv_events", "pv-release.v2", "details");
    expect(events.schemaVersion).toBe("pv_events.v3");
    expect(
      (events.columns as readonly { name: string }[]).map((x) => x.name),
    ).toEqual(
      (DUCKDB_SCHEMA_REGISTRY.pv_events.columns as readonly { name: string }[])
        .map((x) => x.name)
        .filter(
          (name) =>
            ![
              "description",
              "preblast",
              "preblast_rich",
              "backblast",
              "backblast_rich",
              "meta",
            ].includes(name),
        ),
    );
    expect(DUCKDB_DETAILS_SCHEMA_REGISTRY.pv_event_details.columns).toEqual([
      { name: "event_id", logicalType: "INTEGER", nullable: true },
      { name: "description", logicalType: "VARCHAR", nullable: true },
      { name: "preblast", logicalType: "VARCHAR", nullable: true },
      { name: "preblast_rich", logicalType: "JSON", nullable: true },
      { name: "backblast", logicalType: "VARCHAR", nullable: true },
      { name: "backblast_rich", logicalType: "JSON", nullable: true },
      { name: "meta", logicalType: "JSON", nullable: true },
      {
        name: "refreshed_at",
        logicalType: "TIMESTAMP WITH TIME ZONE",
        nullable: true,
      },
    ]);
  });
});
