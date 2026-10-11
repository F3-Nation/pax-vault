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
// Mirrors DATE_DIFF(CURRENT_DATE(), first_event_date, DAY) in the legacy
// PAX summary query. This is intentionally relative to today's UTC date rather
// than a fixed value, while retaining the query's exclusive day denominator.
const paxEffectivePercentage =
  (2 /
    ((Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ) -
      Date.UTC(2024, 0, 1)) /
      86_400_000)) *
  100;
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
    effective_percentage: paxEffectivePercentage,
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
  let executedSql: string[];

  beforeEach(async () => {
    process.env.DUCKDB_ENABLED = "true";
    executedSql = [];
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
       CREATE TABLE pv_attendance(
         refreshed_at TIMESTAMP, id INTEGER, user_id INTEGER, event_instance_id INTEGER,
         q_ind INTEGER, coq_ind INTEGER, start_date DATE, ao_org_id INTEGER,
         region_org_id INTEGER, tags INTEGER[], types INTEGER[], categories VARCHAR[]
       );
      CREATE TABLE pv_regions(region_id INTEGER, region_name VARCHAR, area_id INTEGER, area_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, aos STRUCT(ao_org_id INTEGER)[], types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[]);
      CREATE TABLE pv_aos(ao_id INTEGER, ao_name VARCHAR, region_id INTEGER, region_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[]);
       CREATE TABLE pv_pax(user_id INTEGER, f3_name VARCHAR, home_region_id INTEGER, home_region_name VARCHAR, avatar_url VARCHAR, status VARCHAR, start_date_override DATE, aos STRUCT(id INTEGER)[], regions STRUCT(id INTEGER)[], types STRUCT(id INTEGER)[], tags STRUCT(id INTEGER)[], lifetime_posts BIGINT, lifetime_qs BIGINT);
      CREATE TABLE pv_areas(area_id INTEGER, area_name VARCHAR, sector_id INTEGER, sector_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, regions STRUCT(region_id INTEGER)[]);
      CREATE TABLE pv_sectors(sector_id INTEGER, sector_name VARCHAR, logo_url VARCHAR, is_active BOOLEAN, areas STRUCT(area_id INTEGER)[]);
      CREATE TABLE pv_upcoming(start_date DATE, start_time VARCHAR, ao_name VARCHAR, ao_org_id INTEGER, region_org_id INTEGER, location_name VARCHAR, event_name VARCHAR, event_type VARCHAR, event_category VARCHAR, q_list STRUCT(user_id INTEGER)[]);
      CREATE TABLE pv_kotter(user_id INTEGER, f3_name VARCHAR, avatar_url VARCHAR, kotter_status VARCHAR, total_events INTEGER, first_event_date DATE, days_since_last_event INTEGER, last_event_date DATE, last_event_name VARCHAR, last_event_ao_name VARCHAR, last_event_ao_org_id INTEGER, bestie_list STRUCT(user_id INTEGER)[], home_region_id INTEGER);
       INSERT INTO pv_events VALUES
        (1, DATE '2024-01-01', 'Alpha', 1, 0, NULL, NULL, 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 1, 0, 0, [{id:10}], [], [{user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}]),
        (2, DATE '2024-01-03', 'Bravo', 2, 1, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 1, 0, [{id:11}], [{id:21}], [{user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL},{user_id:11,f3_name:'Boo',q_ind:0,fartsack:true,ghost:false,avatar_url:NULL}]),
         (3, DATE '2024-01-05', 'Charlie', 3, 0, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 1, [], [], []);
       INSERT INTO pv_attendance VALUES
         (CURRENT_TIMESTAMP,1,10,1,1,0,DATE '2024-01-01',NULL,1,[],[],[]),
         (CURRENT_TIMESTAMP,2,10,2,1,0,DATE '2024-01-03',7,1,[],[],[]);
      INSERT INTO pv_regions VALUES (1,'Alpha Region',3,'Area One',NULL,true,[{ao_org_id:7}],[],[]);
      INSERT INTO pv_aos VALUES (7,'Bravo AO',1,'Alpha Region',NULL,true,[],[]);
       INSERT INTO pv_pax VALUES (10,'Ace',1,'Alpha Region',NULL,'active',NULL,[],[],[],[],2,2),(11,'Boo',1,'Alpha Region',NULL,'active',NULL,[],[],[],[],0,0);
      INSERT INTO pv_areas VALUES (3,'Area One',5,'Sector Five',NULL,true,[{region_id:1}]);
      INSERT INTO pv_sectors VALUES (5,'Sector Five',NULL,true,[{area_id:3}]);
    `);
    const connection: DuckDbQueryConnection = {
      query: async <T>(sql: string, params?: unknown[]) => {
        executedSql.push(sql);
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

  it("counts duplicate attendance once per event for region posts and Qs under filters", async () => {
    // The nested event mirror and published attendance table both carry the
    // duplicate, but event-based metrics count it once.
    await native.run(`
      UPDATE pv_events SET attendance = list_append(attendance,
        {user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL})
        WHERE event_id = 2;
      INSERT INTO pv_attendance VALUES
        (CURRENT_TIMESTAMP,3,10,2,1,0,DATE '2024-01-03',7,1,[],[],[]),
        (CURRENT_TIMESTAMP,4,10,4,1,0,DATE '2024-01-04',7,2,[],[],[]);
      INSERT INTO pv_events VALUES
        (4, DATE '2024-01-04', 'Delta', 1, 0, 7, 'Bravo AO', 2, 'Other Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 1, [], [],
          [{user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}]);
    `);

    const page = await getRegionPage(1, "fixture@example.com", {
      startDate: "2024-01-01",
      endDate: "2024-01-03",
      aoIds: [0, 7],
    });
    expect(page.leaders).toEqual([
      expect.objectContaining({
        user_id: 10,
        posts: 2,
        qs: 2,
        all_posts: 2,
        all_qs: 2,
      }),
    ]);
    expect(page.charts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2024-01-01", q_count: 1 }),
        expect.objectContaining({ date: "2024-01-03", q_count: 1 }),
      ]),
    );
    const careerSql = executedSql.find((sql) => sql.includes("scoped_pax"));
    const leaderSql = executedSql.find(
      (sql) =>
        sql.includes("FROM pv_attendance a") && sql.includes("filtered_events"),
    );
    expect(careerSql).toContain("count(DISTINCT a.event_instance_id)");
    expect(careerSql).toContain(
      "JOIN pv_events e ON e.event_id = a.event_instance_id",
    );
    expect(careerSql).toContain("home_region_id = ?");
    expect(careerSql).toContain("lifetime_posts");
    expect(careerSql).toContain("lifetime_qs");
    expect(leaderSql).toContain(
      "JOIN filtered_events ON filtered_events.event_id = a.event_instance_id",
    );
    expect(leaderSql).toContain("event_date >= CAST(? AS DATE)");
    expect(leaderSql).toContain("ao_org_id IS NULL OR ao_org_id IN (?)");
    expect(leaderSql).toContain("count(DISTINCT a.event_instance_id)");
    expect(leaderSql).toContain("a.q_ind = 1");
  });

  it("preserves PAX page membership for true, false, and NULL fartsack flags", async () => {
    await native.run(`
      INSERT INTO pv_pax VALUES
        (42,'Membership Fixture',1,'Alpha Region',NULL,'active',NULL,[],[],[],[],NULL,NULL);
      INSERT INTO pv_events VALUES
        (4201, DATE '2024-02-01', 'False flag', 1, 0, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 1, 0, 0, [], [],
          [{user_id:42,f3_name:'Membership Fixture',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}]),
        (4202, DATE '2024-02-02', 'NULL flag', 1, 0, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 1, 0, [], [],
          [{user_id:42,f3_name:'Membership Fixture',q_ind:0,fartsack:NULL,ghost:false,avatar_url:NULL}]),
        (4203, DATE '2024-02-03', 'True flag', 1, 0, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 1, [], [],
          [{user_id:42,f3_name:'Membership Fixture',q_ind:1,fartsack:true,ghost:false,avatar_url:NULL}]),
        (4204, DATE '2024-02-04', 'No attendance', 0, 0, 7, 'Bravo AO', 1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 0, [], [], [])
    `);

    const page = await getPaxPage(42, undefined, {
      startDate: "2024-02-01",
      endDate: "2024-02-04",
    });

    expect(page.info).toMatchObject({
      user_id: 42,
      f3_name: "Membership Fixture",
    });
    expect(page.summary).toMatchObject({
      event_count: 2,
      q_count: 1,
      fartsack_count: 1,
      first_event_date: "2024-02-01",
      last_event_date: "2024-02-02",
      first_q_date: "2024-02-01",
      last_q_date: "2024-02-01",
    });
    expect(page.events).toHaveLength(2);
    expect(page.events?.map((event) => event.event_instance_id)).toEqual([
      4202, 4201,
    ]);
    expect(page.events?.[0]).toMatchObject({
      event_name: "NULL flag",
      attendance: [expect.objectContaining({ user_id: 42, fartsack: null })],
      fartsacks: [],
    });
    expect(page.events?.[1]).toMatchObject({
      event_name: "False flag",
      attendance: [expect.objectContaining({ user_id: 42, fartsack: false })],
      fartsacks: [],
    });
    expect(page.ao_breakdown).toEqual([
      expect.objectContaining({
        ao_org_id: 7,
        total_events: 2,
        total_q_count: 1,
      }),
    ]);
    expect(page.ao_weekly).toEqual([
      expect.objectContaining({ ao_org_id: 7, posts: 2 }),
    ]);
    const membershipSql = executedSql.find((sql) =>
      /SELECT event_id AS event_instance_id[\s\S]*FROM pv_events WHERE list_contains/i.test(
        sql,
      ),
    );
    expect(membershipSql).toMatch(
      /list_contains\(list_transform\(attendance, a -> a\.user_id\), \?\)/i,
    );
    expect(membershipSql).not.toMatch(/UNNEST\(attendance\)/i);
  });

  it("executes a region page without filters on native DuckDB", async () => {
    const region = await getRegionPage(1, "fixture@example.com");

    expect(region.summary).toMatchObject({
      event_count: 3,
      unique_pax: 1,
      unique_qs: 1,
      fng_count: 1,
    });
    expect(region.events).toHaveLength(3);
    expect(region.events?.[0]).toMatchObject({ event_instance_id: 3 });
    expect(region.leaders).toEqual([
      expect.objectContaining({
        user_id: 10,
        posts: 2,
        all_posts: 2,
        all_qs: 2,
      }),
    ]);
    expect(
      executedSql.some((sql) => sql.includes("p.lifetime_posts AS all_posts")),
    ).toBe(true);
    expect(
      executedSql.some((sql) => sql.includes("JOIN filtered_events")),
    ).toBe(false);
    expect(
      executedSql.some((sql) =>
        sql.includes("FROM pv_attendance a JOIN targets USING (user_id)"),
      ),
    ).toBe(false);
    // The only BigQuery request in this native path is the intentional
    // preference lookup; native query failures do not retry the legacy path.
    expect(queryBigQuery).toHaveBeenCalledTimes(1);
  });

  it("falls back to distinct attendance totals for null lifetime fields and missing profiles", async () => {
    await native.run(`
      INSERT INTO pv_pax VALUES
        (97,'Cross Region Leader',2,'Other Region',NULL,'active',NULL,[],[],[],[],15,3),
        (99,'Cross Region Visitor',2,'Other Region',NULL,'active',NULL,[],[],[],[],NULL,NULL);
      INSERT INTO pv_events VALUES
        (50, DATE '2024-01-06', 'Visitor Event', 2, 0, 7, 'Bravo AO', 1, 'Alpha Region',
         3, 'Area One', 5, 'Sector Five', 0, 0, 1, [], [],
         [{user_id:97,f3_name:'Cross Region Leader',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL},
          {user_id:99,f3_name:'Cross Region Visitor',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL},
          {user_id:98,f3_name:'Unprofiled Visitor',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}]);
      INSERT INTO pv_attendance VALUES
        (CURRENT_TIMESTAMP,99,97,50,1,0,DATE '2024-01-06',7,1,[],[],[]),
        (CURRENT_TIMESTAMP,100,99,50,1,0,DATE '2024-01-06',7,1,[],[],[]),
        (CURRENT_TIMESTAMP,101,98,50,1,0,DATE '2024-01-06',7,1,[],[],[]);
    `);

    const page = await getRegionPage(1, "fixture@example.com");
    expect(page.leaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 97,
          posts: 1,
          qs: 1,
          all_posts: 15,
          all_qs: 3,
        }),
        expect.objectContaining({
          user_id: 99,
          posts: 1,
          qs: 1,
          all_posts: 1,
          all_qs: 1,
        }),
        expect.objectContaining({
          user_id: 98,
          posts: 1,
          qs: 1,
          all_posts: 1,
          all_qs: 1,
        }),
      ]),
    );
    expect(
      executedSql.some((sql) => sql.includes("p.lifetime_posts AS all_posts")),
    ).toBe(true);
    expect(
      executedSql.some((sql) =>
        sql.includes("FROM pv_attendance a JOIN targets USING (user_id)"),
      ),
    ).toBe(true);
  });

  it("falls back to distinct event totals for null career lifetime counters", async () => {
    const recentDate = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    await native.run(`
      INSERT INTO pv_pax VALUES
        (90,'Null Lifetime',1,'Alpha Region',NULL,'active',NULL,[],[],[],[],NULL,NULL)
    `);
    for (let index = 0; index < 24; index++) {
      const eventId = 9000 + index;
      const q = index === 0 ? 1 : 0;
      const duplicateQ =
        index === 0
          ? ",{user_id:90,f3_name:'Null Lifetime',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}"
          : "";
      await native.run(`
        INSERT INTO pv_events VALUES
          (${eventId}, DATE '${recentDate}', 'Fallback ${index}', 1, 0, 7, 'Bravo AO',
           1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 0, [], [],
           [{user_id:90,f3_name:'Null Lifetime',q_ind:${q},fartsack:false,ghost:false,avatar_url:NULL}${duplicateQ}]);
        INSERT INTO pv_attendance VALUES
          (CURRENT_TIMESTAMP,${200 + index},90,${eventId},${q},0,DATE '${recentDate}',7,1,[],[],[])
          ${index === 0 ? `,(CURRENT_TIMESTAMP,300,90,${eventId},1,0,DATE '${recentDate}',7,1,[],[],[])` : ""}
      `);
    }

    const page = await getRegionPage(1, "fixture@example.com");
    expect(page.leaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 90,
          posts: 24,
          qs: 1,
          all_posts: 24,
          all_qs: 1,
        }),
      ]),
    );
    expect(page.achievements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 90,
          region_posts: 24,
          region_qs: 1,
          all_posts: 24,
          all_qs: 1,
          last_region_event_date: recentDate,
        }),
      ]),
    );
  });

  it("bounds leader totals by page filters while computing career totals in DuckDB", async () => {
    const recentDate = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const qValues = ["0", "NULL", "2", "-1"];
    for (let i = 0; i < 22; i++) {
      const extraAttendance =
        i === 0
          ? ", {user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}, {user_id:10,f3_name:'Ace',q_ind:NULL,fartsack:NULL,ghost:false,avatar_url:NULL}"
          : i === 1
            ? ", {user_id:10,f3_name:'Ace',q_ind:-1,fartsack:true,ghost:false,avatar_url:NULL}"
            : "";
      await native.run(`
        INSERT INTO pv_events VALUES (
          ${100 + i}, DATE '${recentDate}', 'Career ${i}', 1, 0, 7, 'Bravo AO',
          1, 'Alpha Region', 3, 'Area One', 5, 'Sector Five', 0, 0, 0, [], [],
          [{user_id:10,f3_name:'Ace',q_ind:${qValues[i % qValues.length]},fartsack:false,ghost:false,avatar_url:NULL}, {user_id:NULL,f3_name:NULL,q_ind:2,fartsack:false,ghost:false,avatar_url:NULL}${extraAttendance}]
        )
      `);
    }
    await native.run(`
      INSERT INTO pv_pax VALUES
        (0,'Zero',1,'Alpha Region',NULL,'active',NULL,[],[],[],[],NULL,NULL),
        (NULL,'Null ID',1,'Alpha Region',NULL,'active',NULL,[],[],[],[],NULL,NULL)
    `);
    await native.run(`
      INSERT INTO pv_events VALUES (
        200, DATE '2022-01-01', 'Nationwide', 1, 0, NULL, NULL, 9, 'Other Region',
        NULL, NULL, NULL, NULL, 0, 0, 0, [], [],
        [{user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL},
         {user_id:10,f3_name:'Ace',q_ind:1,fartsack:false,ghost:false,avatar_url:NULL},
         {user_id:10,f3_name:'Ace',q_ind:1,fartsack:true,ghost:false,avatar_url:NULL},
         {user_id:NULL,f3_name:NULL,q_ind:1,fartsack:false,ghost:false,avatar_url:NULL}]
      )
    `);
    await native.run(`
      INSERT INTO pv_events VALUES
        (201, DATE '2024-01-04', 'Filtered foreign region', 1, 0, NULL, NULL, 9, 'Other Region',
         NULL, NULL, NULL, NULL, 0, 0, 0, [], [],
         [{user_id:10,f3_name:'Ace',q_ind:2,fartsack:false,ghost:false,avatar_url:NULL},
          {user_id:10,f3_name:'Ace',q_ind:0,fartsack:false,ghost:false,avatar_url:NULL},
          {user_id:10,f3_name:'Ace',q_ind:NULL,fartsack:NULL,ghost:false,avatar_url:NULL},
          {user_id:10,f3_name:'Ace',q_ind:-1,fartsack:false,ghost:false,avatar_url:NULL},
          {user_id:10,f3_name:'Ace',q_ind:2,fartsack:true,ghost:false,avatar_url:NULL}]),
        (202, NULL, 'Null date', 1, 0, NULL, NULL, 9, 'Other Region',
         NULL, NULL, NULL, NULL, 0, 0, 0, [], [],
         [{user_id:10,f3_name:'Ace',q_ind:-1,fartsack:NULL,ghost:false,avatar_url:NULL}])
    `);

    await native.run(`
      DELETE FROM pv_attendance;
      INSERT INTO pv_attendance
      SELECT CURRENT_TIMESTAMP, row_number() OVER ()::INTEGER, a.attendee.user_id,
        e.event_id, a.attendee.q_ind, 0, e.event_date, e.ao_org_id, e.region_org_id,
        [], [], []
      FROM pv_events e CROSS JOIN UNNEST(e.attendance) AS a(attendee)
      WHERE a.attendee.user_id IS NOT NULL AND a.attendee.fartsack IS NOT TRUE
    `);

    const careerBaselineResult = await native.runAndReadAll(`
      SELECT a.attendee.user_id AS user_id,
        count(DISTINCT (e.event_id, a.attendee.user_id)) AS all_posts,
        count(DISTINCT (e.event_id, a.attendee.user_id)) FILTER (WHERE e.region_org_id = 1) AS region_posts,
        count(DISTINCT e.event_id) FILTER (WHERE a.attendee.q_ind = 1) AS all_qs,
        count(DISTINCT e.event_id) FILTER (WHERE e.region_org_id = 1 AND a.attendee.q_ind = 1) AS region_qs
      FROM pv_events e CROSS JOIN UNNEST(e.attendance) AS a(attendee)
      JOIN pv_pax p ON p.user_id = a.attendee.user_id
      WHERE p.home_region_id = 1 AND a.attendee.user_id IS NOT NULL
        AND a.attendee.fartsack IS NOT TRUE
      GROUP BY a.attendee.user_id
    `);
    await careerBaselineResult.readAll();
    const careerBaseline = careerBaselineResult.getRowObjectsJS()[0] as {
      all_posts: bigint;
      all_qs: bigint;
    };
    expect(Number(careerBaseline.all_posts)).toBe(27);
    expect(Number(careerBaseline.all_qs)).toBe(4);
    expect(Number(careerBaselineResult.getRowObjectsJS()[0].region_qs)).toBe(3);
    await native.run(
      `UPDATE pv_pax SET lifetime_posts = ?, lifetime_qs = ? WHERE user_id = 10`,
      [careerBaseline.all_posts, careerBaseline.all_qs] as never,
    );

    const region = await getRegionPage(1, "fixture@example.com", {
      startDate: "2024-01-01",
      endDate: "2024-01-05",
    });

    const leaderBaselineResult = await native.runAndReadAll(`
      SELECT count(DISTINCT e.event_id) AS all_posts,
        count(DISTINCT e.event_id) FILTER (WHERE a.attendee.q_ind = 1) AS all_qs
      FROM pv_events e CROSS JOIN UNNEST(e.attendance) AS a(attendee)
      WHERE e.event_date BETWEEN DATE '2024-01-01' AND DATE '2024-01-05'
        AND a.attendee.user_id = 10 AND a.attendee.fartsack IS NOT TRUE
    `);
    await leaderBaselineResult.readAll();
    const leaderBaseline = leaderBaselineResult.getRowObjectsJS()[0] as {
      all_posts: bigint;
      all_qs: bigint;
    };
    expect(Number(leaderBaseline.all_posts)).toBe(3);
    expect(Number(leaderBaseline.all_qs)).toBe(2);

    expect(region.leaders).toEqual([
      expect.objectContaining({
        user_id: 10,
        posts: 2,
        all_posts: 3,
        all_qs: 2,
      }),
    ]);
    expect(region.achievements).toEqual([
      expect.objectContaining({
        user_id: 10,
        region_posts: 24,
        region_qs: Number(careerBaselineResult.getRowObjectsJS()[0].region_qs),
        all_posts: 27,
        all_qs: Number(careerBaseline.all_qs),
        fng_date: "2022-01-01",
        last_region_event_date: recentDate,
      }),
    ]);
    expect(
      region.achievements?.some((p: { user_id: number }) => p.user_id === 0),
    ).toBe(false);
    expect(
      executedSql.some((sql) => /targets\(user_id\).*VALUES/is.test(sql)),
    ).toBe(true);
    const groupedLeadersSql = executedSql.find((sql) =>
      /JOIN filtered_events ON filtered_events\.event_id = a\.event_instance_id/i.test(
        sql,
      ),
    );
    expect(groupedLeadersSql).toMatch(
      /JOIN targets ON targets\.user_id = a\.user_id/i,
    );
    expect(groupedLeadersSql).toMatch(/a\.user_id IS NOT NULL/i);
    expect(groupedLeadersSql).not.toMatch(/a\.fartsack/i);
    expect(groupedLeadersSql).toMatch(/a\.q_ind = 1/i);
    const postsSql = executedSql.find((sql) => sql.includes("scoped_pax"));
    expect(postsSql).toMatch(
      /JOIN pv_events e ON e\.event_id = a\.event_instance_id/i,
    );
    expect(postsSql).toMatch(/count\(DISTINCT a\.event_instance_id\)/i);
    expect(postsSql).not.toMatch(/a\.fartsack/i);
    expect(
      executedSql.some((sql) =>
        /scoped_pax AS \([\s\S]*user_id IS NOT NULL/i.test(sql),
      ),
    ).toBe(true);
    expect(
      executedSql.some((sql) => sql.includes("FROM pv_attendance a")),
    ).toBe(true);
    expect(queryBigQuery).toHaveBeenCalledTimes(1);
  });
});

void SOURCE_READ_AT;
