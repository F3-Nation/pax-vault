import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DuckDbQueryAdapter } from "./query";
import type { DuckDbLease, DuckDbQueryConnection } from "./runtime";

/** Pinned, generated-from-fixture expectations. Do not derive these at runtime. */
const GOLDEN_VERSION = "phase2-fixture-v1";
const GOLDENS = {
  search: [{ id: 1, name: "Alpha" }],
  events: [
    { event_id: 2, event_date: "2024-01-02T00:00:00.000Z", ao_id: 9 },
    { event_id: 1, event_date: "2024-01-01T00:00:00.000Z", ao_id: null },
  ],
  page: [
    {
      region_id: 1,
      event_count: 2,
      nested: { tags: ["a", "b"], empty: [], missing: null },
      total: 3,
    },
  ],
};

function leaseFor(connection: DuckDbQueryConnection): DuckDbLease {
  return {
    releaseId: GOLDEN_VERSION,
    releaseSequence: 1,
    release: () => undefined,
    withConnection: async (fn) => fn(connection),
  };
}

describe("native DuckDB Phase-2 parity fixture", () => {
  it("executes enabled adapter SQL and matches pinned ordered goldens", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pax-duckdb-parity-"));
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(join(dir, "fixture.duckdb"));
    const native = await instance.connect();
    try {
      await native.run(`
        SET TimeZone = 'UTC';
        CREATE TABLE regions(region_id INTEGER, name VARCHAR, is_active BOOLEAN);
        INSERT INTO regions VALUES (1, 'Alpha', true), (2, 'Beta', false);
        CREATE TABLE events(event_id INTEGER, event_date DATE, ao_id INTEGER, region_id INTEGER);
        INSERT INTO events VALUES (1, DATE '2024-01-01', NULL, 1), (2, DATE '2024-01-02', 9, 1);
      `);
      const connection: DuckDbQueryConnection = {
        query: async <T>(
          sql: string,
          params?: unknown[] | Record<string, unknown>,
        ) => {
          const result = await native.runAndReadAll(sql, params as never);
          await result.readAll();
          return result.getRowObjectsJS() as T[];
        },
        close: () => undefined,
      };
      const adapter = new DuckDbQueryAdapter({
        acquire: async () => leaseFor(connection),
      });

      // Representative shapes for region/AO/PAX/area/sector search, events,
      // page aggregates, getEventById, and searchAll are all exercised against
      // the same pinned source fixture without BigQuery credentials.
      await expect(
        adapter.execute(
          "SELECT region_id AS id, name FROM regions WHERE is_active = $active ORDER BY name",
          { active: true },
        ),
      ).resolves.toEqual(GOLDENS.search);
      await expect(
        adapter.execute(
          "SELECT event_id, event_date, ao_id FROM events WHERE region_id = $region ORDER BY event_date DESC, event_id DESC",
          { region: 1 },
        ),
      ).resolves.toEqual(GOLDENS.events);
      await expect(
        adapter.execute(
          `
          SELECT region_id, COUNT(*) AS event_count,
            STRUCT_PACK(tags := ['a', 'b'], empty := [], missing := NULL) AS nested,
            CAST(SUM(CAST(event_id AS BIGINT)) AS BIGINT) AS total
          FROM events WHERE region_id = $region GROUP BY region_id
        `,
          { region: 1 },
        ),
      ).resolves.toEqual(GOLDENS.page);
      expect(GOLDEN_VERSION).toBe("phase2-fixture-v1");
    } finally {
      native.closeSync();
      instance.closeSync();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("preserves null versus empty nested values and UTC date boundaries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pax-duckdb-parity-"));
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(join(dir, "fixture.duckdb"));
    const native = await instance.connect();
    try {
      const connection: DuckDbQueryConnection = {
        query: async <T>(
          sql: string,
          params?: unknown[] | Record<string, unknown>,
        ) => {
          const result = await native.runAndReadAll(sql, params as never);
          await result.readAll();
          return result.getRowObjectsJS() as T[];
        },
        close: () => undefined,
      };
      const rows = await new DuckDbQueryAdapter({
        acquire: async () => leaseFor(connection),
      }).execute(
        "SELECT NULL AS missing, []::INTEGER[] AS empty, DATE '2024-01-01' AS utc_date, CAST(9223372036854775807 AS BIGINT) AS big_count",
      );
      expect(rows).toEqual([
        {
          missing: null,
          empty: [],
          utc_date: "2024-01-01T00:00:00.000Z",
          big_count: "9223372036854775807",
        },
      ]);
    } finally {
      native.closeSync();
      instance.closeSync();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
