import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DuckDBConnection } from "@duckdb/node-api";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// The only BigQuery work allowed by the migrated reads is the user preference
// merge in getEventById.  Keeping it explicit also proves that a failed native
// query is not silently retried against BigQuery.
const { queryBigQuery } = vi.hoisted(() => ({
  queryBigQuery: vi.fn(async () => [
    { preferencesJson: '{"compact":true}', json_config: '{"compact":true}' },
  ]),
}));
vi.mock("@/lib/db", () => ({ queryBigQuery }));

import { setDuckDbRuntimeForTests } from "./factory";
import type { DuckDbLease, DuckDbQueryConnection } from "./runtime";
import {
  getEvents as getRegionEvents,
  getPageData as getRegionPage,
} from "@/lib/bq/regions";
import {
  getEvents as getAoEvents,
  getPageData as getAoPage,
} from "@/lib/bq/aos";
import {
  getEvents as getPaxEvents,
  getPageData as getPaxPage,
} from "@/lib/bq/pax";
import { searchAreasByName, getPageData as getAreaPage } from "@/lib/bq/areas";
import {
  searchSectorsByName,
  getPageData as getSectorPage,
} from "@/lib/bq/sectors";
import { getEventById } from "@/lib/bq/events";
import { searchAll } from "@/lib/bq/search";
import { searchRegionsByName } from "@/lib/bq/regions";
import { searchAOsByName } from "@/lib/bq/aos";
import { searchUsersByName } from "@/lib/bq/pax";

const SOURCE_SNAPSHOT = "phase2-native-fixture-snapshot-2026-01-01";
const SOURCE_READ_AT = "2026-01-01T00:00:00.000Z";
const GOLDEN_EVENT = {
  event_instance_id: 2,
  event_date: "2024-01-03T00:00:00.000Z",
  event_name: "Bravo",
  pax_count: 2,
  fng_count: 1,
  ao_org_id: 7,
  ao_name: "Bravo AO",
  region_org_id: 1,
  region_name: "Alpha Region",
  area_org_id: 3,
  area_name: "Area One",
  sector_org_id: 5,
  sector_name: "Sector Five",
  first_f_ind: 0,
  second_f_ind: 1,
  third_f_ind: 0,
  types: [{ id: 11 }],
  tags: [{ id: 21 }],
  attendance: [
    {
      user_id: 10,
      f3_name: "Ace",
      q_ind: 1,
      fartsack: false,
      ghost: false,
      avatar_url: null,
    },
  ],
  fartsacks: [
    {
      user_id: 11,
      f3_name: "Boo",
      q_ind: 0,
      fartsack: true,
      ghost: false,
      avatar_url: null,
    },
  ],
};
const REGION_PAGE_GOLDEN = {
  summary: {
    event_count: 3,
    ao_count: 1,
    active_pax: 0,
    unique_pax: 1,
    unique_qs: 1,
    fng_count: 1,
    pax_count_average: 2,
    fartsack_kings: [{ user_id: 11, f3_name: "Boo", count: 1 }],
    ghost_kings: [],
  },
  leaders: [
    { user_id: 10, f3_name: "Ace", posts: 2, qs: 2, all_posts: 2, all_qs: 2 },
  ],
  achievements: [],
  charts: [
    {
      date: "2024-01-01",
      pax_count: 1,
      fng_count: 0,
      q_count: 1,
      unique_pax_count: 1,
      unique_q_count: 1,
    },
    {
      date: "2024-01-02",
      pax_count: 0,
      fng_count: 0,
      q_count: 0,
      unique_pax_count: 0,
      unique_q_count: 0,
    },
    {
      date: "2024-01-03",
      pax_count: 2,
      fng_count: 1,
      q_count: 1,
      unique_pax_count: 1,
      unique_q_count: 1,
    },
    {
      date: "2024-01-04",
      pax_count: 0,
      fng_count: 0,
      q_count: 0,
      unique_pax_count: 0,
      unique_q_count: 0,
    },
    {
      date: "2024-01-05",
      pax_count: 3,
      fng_count: 0,
      q_count: 0,
      unique_pax_count: 0,
      unique_q_count: 0,
    },
  ],
  aoBreakdown: [
    { ao_id: 7, ao_name: "Bravo AO", beatdowns: 2 },
    { ao_id: 0, ao_name: "(No AO)", beatdowns: 1 },
  ],
};
const AO_PAGE_GOLDEN = {
  summary: {
    event_count: 2,
    first_event_date: "2024-01-03",
    active_pax: 0,
    unique_pax: 1,
    unique_qs: 1,
    fng_count: 1,
    pax_count_average: 2.5,
    fartsack_kings: [{ user_id: 11, f3_name: "Boo", count: 1 }],
    ghost_kings: [],
  },
  leaders: [{ user_id: 10, f3_name: "Ace", posts: 1, qs: 1 }],
};
const PAX_PAGE_GOLDEN = {
  summary: {
    event_count: 2,
    q_count: 2,
    ghost_count: 0,
    fartsack_count: 0,
    fng_date: "2024-01-01",
    first_event_date: "2024-01-01",
    first_event_ao_id: null,
    first_event_ao_name: null,
    last_event_date: "2024-01-03",
    last_event_ao_id: 7,
    last_event_ao_name: "Bravo AO",
    bestie_user_id: null,
    bestie_user_count: 0,
    bestie_f3_name: null,
    unique_users_met: 0,
    first_q_date: "2024-01-01",
    first_q_ao_id: null,
    first_q_ao_name: null,
    last_q_date: "2024-01-03",
    last_q_ao_id: 7,
    last_q_ao_name: "Bravo AO",
    unique_pax_when_q: 0,
    effective_percentage: 0.2012072434607646,
  },
  ao_breakdown: [
    {
      ao_org_id: 7,
      ao_name: "Bravo AO",
      region_org_id: 1,
      region_name: "Alpha Region",
      total_events: 1,
      total_q_count: 1,
    },
    {
      ao_org_id: 0,
      ao_name: "Unknown AO",
      region_org_id: 1,
      region_name: "Alpha Region",
      total_events: 1,
      total_q_count: 1,
    },
  ],
  ao_weekly: [
    {
      ao_org_id: 7,
      ao_name: "Bravo AO",
      region_org_id: 1,
      region_name: "Alpha Region",
      week: "2024-01-01",
      posts: 1,
    },
  ],
  activity_window: { start: "2024-01-01", end: "2024-01-01", isDefault: false },
};

describe("migrated service functions on the pinned native release fixture", () => {
  let dir: string;
  let native: DuckDBConnection;
  let instance: { closeSync: () => void };

  beforeEach(async () => {
    process.env.DUCKDB_ENABLED = "true";
    dir = await mkdtemp(join(tmpdir(), "pax-service-parity-"));
    const api = await import("@duckdb/node-api");
    const db = await api.DuckDBInstance.create(join(dir, "release.duckdb"));
    instance = db;
    native = await db.connect();
    await native.run(`
      SET TimeZone='UTC';
      CREATE TABLE pv_events(
        event_id INTEGER, event_date DATE, event_name VARCHAR, pax_count INTEGER,
        fng_count INTEGER, ao_org_id INTEGER, ao_name VARCHAR, region_org_id INTEGER,
        region_name VARCHAR, area_org_id INTEGER, area_name VARCHAR, sector_org_id INTEGER,
        sector_name VARCHAR,
        first_f_ind INTEGER, second_f_ind INTEGER, third_f_ind INTEGER,
        types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[],
        attendance STRUCT(user_id INTEGER, f3_name VARCHAR, q_ind INTEGER, fartsack BOOLEAN, ghost BOOLEAN, avatar_url VARCHAR)[]);
      CREATE TABLE pv_regions(region_id INTEGER, region_name VARCHAR, area_id INTEGER, area_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, aos STRUCT(ao_org_id INTEGER)[], types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[]);
      CREATE TABLE pv_aos(ao_id INTEGER, ao_name VARCHAR, region_id INTEGER, region_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[]);
      CREATE TABLE pv_pax(user_id INTEGER, f3_name VARCHAR, home_region_id INTEGER, home_region_name VARCHAR, avatar_url VARCHAR, status VARCHAR, start_date_override DATE, aos STRUCT(id INTEGER)[], regions STRUCT(id INTEGER)[], types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[]);
      CREATE TABLE pv_areas(area_id INTEGER, area_name VARCHAR, sector_id INTEGER, sector_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, regions STRUCT(region_id INTEGER)[]);
      CREATE TABLE pv_sectors(sector_id INTEGER, sector_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, areas STRUCT(area_id INTEGER)[]);
      CREATE TABLE pv_upcoming(start_date DATE, start_time VARCHAR, ao_name VARCHAR, ao_org_id INTEGER, region_org_id INTEGER, location_name VARCHAR, event_name VARCHAR, event_type VARCHAR, event_category VARCHAR, q_list STRUCT(user_id INTEGER)[]);
      CREATE TABLE pv_kotter(user_id INTEGER, f3_name VARCHAR, avatar_url VARCHAR, kotter_status VARCHAR, total_events INTEGER, first_event_date DATE, days_since_last_event INTEGER, last_event_date DATE, last_event_name VARCHAR, last_event_ao_name VARCHAR, last_event_ao_org_id INTEGER, bestie_list STRUCT(user_id INTEGER)[], home_region_id INTEGER);
      INSERT INTO pv_events VALUES
        (1, DATE '2024-01-01', 'Alpha', 1, 0, NULL, NULL, 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 1, 0, 0, [{id:10}], [], [{user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}]),
        (2, DATE '2024-01-03', 'Bravo', 2, 1, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 1, 0, [{id:11}], [{id:21}], [{user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL},{user_id:11,f3_name:'Boo',q_ind:0,fartsack:true,ghost:false,avatar_url:NULL}]),
        (3, DATE '2024-01-05', 'Charlie', 3, 0, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 1, [], [], []);
      INSERT INTO pv_regions VALUES (1,'Alpha Region',3,'Area One',NULL,true,[{ao_org_id:7}],[],[]);
      INSERT INTO pv_aos VALUES (7,'Bravo AO',1,'Alpha Region',NULL,true,[],[]);
      INSERT INTO pv_pax VALUES (10,'Ace',1,'Alpha Region',NULL,'active',NULL,[],[],[],[]),(11,'Boo',1,'Alpha Region',NULL,'active',NULL,[],[],[],[]);
      INSERT INTO pv_areas VALUES (3,'Area One',5,'Sector Five',NULL,true,[{region_id:1}]);
      INSERT INTO pv_sectors VALUES (5,'Sector Five',NULL,true,[{area_id:3}]);
    `);
    const connection: DuckDbQueryConnection = {
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await native.runAndReadAll(sql, params as never);
        await result.readAll();
        return result.getRowObjectsJS() as T[];
      },
      close: () => undefined,
    };
    const lease: DuckDbLease = {
      releaseId: SOURCE_SNAPSHOT,
      releaseSequence: 1,
      release: () => undefined,
      withConnection: async (fn) => fn(connection),
    };
    setDuckDbRuntimeForTests({
      acquire: async () => lease,
      refresh: async () => undefined,
      close: async () => undefined,
      status: () => ({ refreshFailureCount: 0 }),
    });
  });

  afterEach(async () => {
    setDuckDbRuntimeForTests();
    native.closeSync();
    instance.closeSync();
    await rm(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("runs region/AO/PAX event paths with filters, ordering, nulls, and pagination", async () => {
    expect(
      await getRegionEvents(1, undefined, { aoIds: [0], limit: 1 }),
    ).toEqual([expect.objectContaining({ event_instance_id: 1 })]);
    expect(
      await getAoEvents(7, undefined, {
        startDate: "2024-01-03",
        endDate: "2024-01-05",
        limit: 1,
      }),
    ).toEqual([expect.objectContaining({ event_instance_id: 3 })]);
    expect(
      await getPaxEvents(10, undefined, { tagIds: [21], limit: 1 }),
    ).toEqual([expect.objectContaining({ event_instance_id: 2 })]);
  });

  it("matches the full ordered event shape and performs the intentional preference merge", async () => {
    expect(await getEventById(2, "fixture@example.com")).toEqual({
      ...GOLDEN_EVENT,
      preferencesJson: '{"compact":true}',
    });
    expect(queryBigQuery).toHaveBeenCalledTimes(1);
    expect(await getEventById(999)).toBeNull();
    expect(queryBigQuery).toHaveBeenCalledTimes(1);
  });

  it("executes every native search service and preserves ordered result shapes", async () => {
    expect(await searchRegionsByName("alpha")).toEqual([
      {
        region_id: 1,
        region_name: "Alpha Region",
        logo_url: null,
        is_active: true,
      },
    ]);
    expect(await searchAOsByName("bravo")).toEqual([
      {
        ao_id: 7,
        ao_name: "Bravo AO",
        region_id: 1,
        region_name: "Alpha Region",
        logo_url: null,
        is_active: true,
      },
    ]);
    expect(await searchUsersByName("ace")).toEqual([
      {
        user_id: 10,
        f3_name: "Ace",
        home_region_id: 1,
        home_region_name: "Alpha Region",
        avatar_url: null,
        status: "active",
      },
    ]);
    expect(await searchAreasByName("area")).toEqual([
      { area_id: 3, area_name: "Area One", logo_url: null, is_active: true },
    ]);
    expect(await searchSectorsByName("sector")).toEqual([
      {
        sector_id: 5,
        sector_name: "Sector Five",
        logo_url: null,
        is_active: true,
      },
    ]);
    expect(await searchAll("a")).toEqual({ regions: [], aos: [], pax: [] });
    expect(await searchAll("alp", undefined, true)).toEqual({
      regions: [
        {
          region_id: 1,
          region_name: "Alpha Region",
          logo_url: null,
          is_active: true,
        },
      ],
      aos: [],
      pax: [],
    });
    expect(queryBigQuery).not.toHaveBeenCalled();
  });

  it("returns static aggregate goldens, including UTC gap filling", async () => {
    expect(
      await getAreaPage(3, undefined, {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
      }),
    ).toMatchObject({
      summary: expect.objectContaining({
        event_count: 3,
        unique_pax: 1,
        unique_qs: 1,
      }),
      charts: expect.arrayContaining([
        expect.objectContaining({ date: "2024-01-02", pax_count: 0 }),
      ]),
    });
    expect(
      await getSectorPage(5, undefined, {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
      }),
    ).toMatchObject({
      summary: expect.objectContaining({ event_count: 3, area_count: 1 }),
      charts: expect.arrayContaining([
        expect.objectContaining({ date: "2024-01-02", pax_count: 0 }),
      ]),
    });
  });

  it("executes the region, AO, and PAX native page exports without fallback", async () => {
    const [region, ao, pax] = await Promise.all([
      getRegionPage(1, "fixture@example.com", {
        aoIds: [0, 7],
        startDate: "2024-01-01",
        endDate: "2024-01-05",
      }),
      getAoPage(7, "fixture@example.com", {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
      }),
      getPaxPage(10, "fixture@example.com", {
        startDate: "2024-01-01",
        endDate: "2024-01-05",
      }),
    ]);
    expect(region.summary).toEqual(REGION_PAGE_GOLDEN.summary);
    expect(region.leaders).toEqual(REGION_PAGE_GOLDEN.leaders);
    expect(region.achievements).toEqual(REGION_PAGE_GOLDEN.achievements);
    expect(region.charts).toEqual(REGION_PAGE_GOLDEN.charts);
    expect(region.aoBreakdown).toEqual(REGION_PAGE_GOLDEN.aoBreakdown);
    expect(ao.summary).toEqual(AO_PAGE_GOLDEN.summary);
    expect(ao.leaders).toEqual(AO_PAGE_GOLDEN.leaders);
    expect(pax.summary).toEqual(PAX_PAGE_GOLDEN.summary);
    expect(pax.ao_breakdown).toEqual(PAX_PAGE_GOLDEN.ao_breakdown);
    expect(pax.ao_weekly).toEqual(PAX_PAGE_GOLDEN.ao_weekly);
    expect(pax.activity_window).toEqual(PAX_PAGE_GOLDEN.activity_window);
    expect(region.preferencesJson).toBe('{"compact":true}');
    expect(ao.preferencesJson).toBe('{"compact":true}');
    expect(region.events).toHaveLength(3);
    expect(ao.events).toHaveLength(2);
    expect(pax.events).toHaveLength(2);
    expect(await getRegionEvents(1, undefined, { limit: 1 })).toHaveLength(1);
    expect(SOURCE_SNAPSHOT).toBe("phase2-native-fixture-snapshot-2026-01-01");
    expect(SOURCE_READ_AT).toBe("2026-01-01T00:00:00.000Z");
    expect(queryBigQuery).toHaveBeenCalled();
  });
});

void SOURCE_READ_AT;
