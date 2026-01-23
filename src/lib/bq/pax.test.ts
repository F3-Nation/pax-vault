import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock BigQuery helper
vi.mock("@/lib/db", () => ({
  queryBigQuery: vi.fn(),
}));

import { queryBigQuery } from "@/lib/db";
import { getPAXInfo, getEvents, getSummary, getAOBreakdown } from "./pax";

function lastQuery(): string {
  const calls = (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mock
    .calls;
  if (!calls.length)
    throw new Error("Expected queryBigQuery to have been called");
  return String(calls[calls.length - 1]?.[0] ?? "");
}

describe("bq/pax.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPAXInfo queries pv_users and returns first row", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        user_id: 123,
        f3_name: "Django",
        home_region_id: 222,
        home_region_name: "Region Metro",
        avatar_url: null,
        status: "active",
      },
    ]);

    const res = await getPAXInfo(123);

    expect(res).toEqual({
      user_id: 123,
      f3_name: "Django",
      home_region_id: 222,
      home_region_name: "Region Metro",
      avatar_url: null,
      status: "active",
    });

    const q = lastQuery();
    expect(q).toContain("FROM pv_pax");
    expect(q).toContain("WHERE user_id = 123");
    expect(q).toContain("LIMIT 1");
  });

  it("getEvents applies pax attendance filter and optional LIMIT", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, { limit: 50 });

    const q = lastQuery();
    expect(q).toContain("FROM pv_events");
    expect(q).toContain("UNNEST(attendance)");
    expect(q).toContain("a.user_id = 123");
    expect(q).toContain("ORDER BY event_date DESC");
    expect(q).toContain("LIMIT 50");
  });

  it("getEvents ignores non-finite LIMIT", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    // @ts-expect-error intentional
    await getEvents(123, { limit: NaN });

    const q = lastQuery();
    expect(q).toContain("a.user_id = 123");
    expect(q).not.toMatch(/\bLIMIT\b/i);
  });

  it("getEvents includes AO and region include/exclude filters", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, {
      aoIds: [1, 2, Infinity],
      aoMode: "exclude",
      regionIds: [10],
      regionMode: "include",
    });

    const q = lastQuery();
    expect(q).toContain("ao_org_id NOT IN (1,2)");
    expect(q).toContain("region_org_id IN (10)");
  });

  it("getEvents includes startDate-only filter when only startDate provided", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, { startDate: "2025-01-01" });

    const q = lastQuery();
    expect(q).toContain("event_date >= DATE('2025-01-01')");
  });

  it("getEvents includes endDate-only filter when only endDate provided", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, { endDate: "2025-01-31" });

    const q = lastQuery();
    expect(q).toContain("event_date <= DATE('2025-01-31')");
  });

  it("getEvents supports include/exclude variants for aos, regions, tags, types, and categories", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, {
      aoIds: [9],
      // default aoMode is include
      regionIds: [77],
      regionMode: "exclude",
      tagIds: [5],
      // default tagMode is include
      typeIds: [7],
      typeMode: "exclude",
      categoryIds: [2],
      categoryMode: "exclude",
    });

    const q = lastQuery();

    // AO include -> IN
    expect(q).toContain("ao_org_id IN (9)");

    // Region exclude -> NOT IN
    expect(q).toContain("region_org_id NOT IN (77)");

    // Tag include -> EXISTS
    expect(q).toContain(
      "EXISTS (SELECT 1 FROM UNNEST(tags) t WHERE t.id IN (5))",
    );

    // Type exclude -> NOT EXISTS
    expect(q).toContain(
      "NOT EXISTS (SELECT 1 FROM UNNEST(types) ty WHERE ty.id IN (7))",
    );

    // Category exclude -> NOT (...)
    expect(q).toContain("second_f_ind = 1");
    expect(q).toContain("NOT");
  });

  it("getEvents drops non-finite filter ids and omits filters when nothing valid remains", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, {
      aoIds: [Infinity, NaN as unknown as number],
      regionIds: [Infinity],
      tagIds: [NaN as unknown as number],
      typeIds: [Infinity],
      categoryIds: [999],
      categoryMode: "include",
    });

    const q = lastQuery();

    // No valid numeric ids -> IN/NOT IN clauses should not appear for these
    expect(q).not.toMatch(/\bao_org_id\s+(IN|NOT IN)\s*\(/);
    expect(q).not.toMatch(/\bregion_org_id\s+(IN|NOT IN)\s*\(/);

    // No valid tag/type ids -> EXISTS/NOT EXISTS should not appear
    expect(q).not.toMatch(/UNNEST\(tags\)/);
    expect(q).not.toMatch(/UNNEST\(types\)/);

    // Category 999 should be dropped (only 1/2/3 supported)
    expect(q).not.toContain("999");
  });

  it("getEvents includes tag, type, and category filters", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      [],
    );

    await getEvents(123, {
      tagIds: [1, 2],
      tagMode: "exclude",
      typeIds: [10],
      typeMode: "include",
      categoryIds: [1, 3, 999],
      categoryMode: "include",
    });

    const q = lastQuery();

    expect(q).toContain(
      "NOT EXISTS (SELECT 1 FROM UNNEST(tags) t WHERE t.id IN (1,2))",
    );
    expect(q).toContain(
      "EXISTS (SELECT 1 FROM UNNEST(types) ty WHERE ty.id IN (10))",
    );
    expect(q).toContain("(first_f_ind = 1)");
    expect(q).toContain("(third_f_ind = 1)");
    expect(q).not.toContain("999");
  });

  it("getSummary queries pv_events via CTE and returns first row", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        event_count: 10,
        q_count: 2,
        first_event_date: "2023-01-01",
        first_event_ao_id: 1,
        first_event_ao_name: "AO One",
        last_event_date: "2025-01-01",
        last_event_ao_id: 2,
        last_event_ao_name: "AO Two",
        bestie_user_id: 456,
        bestie_f3_name: "Newton",
        bestie_user_count: 12,
        unique_users_met: 100,
        unique_pax_when_q: 40,
        first_q_date: "2023-06-01",
        first_q_ao_id: 1,
        first_q_ao_name: "AO One",
        last_q_date: "2024-12-01",
        last_q_ao_id: 2,
        last_q_ao_name: "AO Two",
        effective_percentage: 55.5,
      },
    ]);

    const res = await getSummary(123, { range: "Last 90 Days" });

    expect(res?.event_count).toBe(10);

    const q = lastQuery();
    expect(q).toContain("WITH events AS (");
    expect(q).toContain("FROM pv_events");
    expect(q).toContain("a.user_id = 123");
  });

  it("getAOBreakdown groups by AO and counts Qs", async () => {
    (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        ao_org_id: 1,
        ao_name: "AO One",
        region_org_id: 10,
        region_name: "Region",
        total_events: 20,
        total_q_count: 5,
      },
    ]);

    const res = await getAOBreakdown(123);

    expect(res).toEqual([
      {
        ao_org_id: 1,
        ao_name: "AO One",
        region_org_id: 10,
        region_name: "Region",
        total_events: 20,
        total_q_count: 5,
      },
    ]);

    const q = lastQuery();
    expect(q).toContain("FROM pv_events");
    expect(q).toContain("GROUP BY ao_org_id");
  });
});
