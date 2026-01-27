// import { describe, it, expect, vi, beforeEach } from "vitest";

// // Mock the BigQuery helper used by this module.
// vi.mock("@/lib/db", () => {
//   return {
//     queryBigQuery: vi.fn(),
//   };
// });

// import { queryBigQuery } from "@/lib/db";

// import {
//   getAOInfo,
//   getEvents,
//   getSummary,
//   getLeaders,
//   getUpcomingEvents,
// } from "./aos";

// function lastQuery(): string {
//   const calls = (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mock
//     .calls;
//   if (!calls.length)
//     throw new Error("Expected queryBigQuery to have been called");
//   return String(calls[calls.length - 1]?.[0] ?? "");
// }

// describe("bq/aos.ts", () => {
//   beforeEach(() => {
//     vi.clearAllMocks();
//   });

//   it("getAOInfo builds a query against pv_aos and returns first row", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
//       {
//         ao_id: 123,
//         ao_name: "AO Dawn",
//         region_id: 999,
//         region_name: "Region Metro",
//         logo_url: null,
//         is_active: true,
//       },
//     ]);

//     const res = await getAOInfo(123);

//     expect(res).toEqual({
//       ao_id: 123,
//       ao_name: "AO Dawn",
//       region_id: 999,
//       region_name: "Region Metro",
//       logo_url: null,
//       is_active: true,
//     });

//     const q = lastQuery();
//     expect(q).toContain("FROM pv_aos");
//     expect(q).toContain("WHERE ao_id = 123");
//     expect(q).toContain("LIMIT 1");
//   });

//   it("getEvents applies ao_org_id filter and optional LIMIT", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getEvents(40364, { limit: 100 });

//     const q = lastQuery();
//     expect(q).toContain("FROM pv_events");
//     expect(q).toContain("WHERE ao_org_id = 40364");
//     expect(q).toContain("ORDER BY event_date DESC");
//     expect(q).toContain("LIMIT 100");
//   });

//   it("getEvents ignores non-finite LIMIT", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     // @ts-expect-error intentional: exercising runtime guard
//     await getEvents(40364, { limit: NaN });

//     const q = lastQuery();
//     expect(q).toContain("WHERE ao_org_id = 40364");
//     expect(q).not.toMatch(/\bLIMIT\b/i);
//   });

//   it("getEvents includes date range when startDate and endDate provided", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getEvents(40364, { startDate: "2025-01-01", endDate: "2025-01-31" });

//     const q = lastQuery();
//     expect(q).toContain(
//       "event_date BETWEEN DATE('2025-01-01') AND DATE('2025-01-31')",
//     );
//   });

//   it("getEvents includes startDate-only filter when only startDate provided", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getEvents(40364, { startDate: "2025-01-01" });

//     const q = lastQuery();
//     expect(q).toContain("event_date >= DATE('2025-01-01')");
//   });

//   it("getEvents includes endDate-only filter when only endDate provided", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getEvents(40364, { endDate: "2025-01-31" });

//     const q = lastQuery();
//     expect(q).toContain("event_date <= DATE('2025-01-31')");
//   });

//   it("getEvents supports include/exclude variants for tags, types, and categories", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getEvents(40364, {
//       tagIds: [5],
//       // default tagMode is include
//       typeIds: [7],
//       typeMode: "exclude",
//       categoryIds: [2],
//       categoryMode: "exclude",
//     });

//     const q = lastQuery();

//     // Tag include -> EXISTS
//     expect(q).toContain(
//       "EXISTS (SELECT 1 FROM UNNEST(tags) t WHERE t.id IN (5))",
//     );

//     // Type exclude -> NOT EXISTS
//     expect(q).toContain(
//       "NOT EXISTS (SELECT 1 FROM UNNEST(types) ty WHERE ty.id IN (7))",
//     );

//     // Category exclude -> NOT (...)
//     expect(q).toContain("second_f_ind = 1");
//     expect(q).toContain("NOT");
//   });

//   it("getEvents includes tag/type/category filters and modes", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getEvents(40364, {
//       tagIds: [1, 2, Infinity, NaN as unknown as number],
//       tagMode: "exclude",
//       typeIds: [10, 11],
//       typeMode: "include",
//       categoryIds: [1, 3, 999],
//       categoryMode: "include",
//     });

//     const q = lastQuery();

//     // Tag exclude -> NOT EXISTS
//     expect(q).toContain(
//       "NOT EXISTS (SELECT 1 FROM UNNEST(tags) t WHERE t.id IN (1,2))",
//     );

//     // Type include -> EXISTS
//     expect(q).toContain(
//       "EXISTS (SELECT 1 FROM UNNEST(types) ty WHERE ty.id IN (10,11))",
//     );

//     // Categories map to first/second/third flags; only 1/2/3 allowed, so 999 should be dropped.
//     expect(q).toContain("(first_f_ind = 1)");
//     expect(q).toContain("(third_f_ind = 1)");
//     expect(q).not.toContain("999");
//   });

//   it("getSummary queries pv_events via CTE and returns first row", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
//       {
//         event_count: 10,
//         active_pax: 5,
//         unique_pax: 20,
//         unique_qs: 7,
//         fng_count: 2,
//         pax_count_average: 12.5,
//       },
//     ]);

//     const res = await getSummary(111, { range: "Last 90 Days" });

//     expect(res).toEqual({
//       event_count: 10,
//       active_pax: 5,
//       unique_pax: 20,
//       unique_qs: 7,
//       fng_count: 2,
//       pax_count_average: 12.5,
//     });

//     const q = lastQuery();
//     expect(q).toContain("WITH events AS (");
//     expect(q).toContain("FROM pv_events");
//     expect(q).toContain("WHERE ao_org_id = 111");
//   });

//   it("getLeaders queries pv_events via CTE and orders by posts/qs", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
//       {
//         user_id: 1,
//         f3_name: "Django",
//         posts: 25,
//         qs: 3,
//         avatar_url: null,
//       },
//     ]);

//     const res = await getLeaders(111, { startDate: "2025-01-01" });

//     expect(res).toEqual([
//       {
//         user_id: 1,
//         f3_name: "Django",
//         posts: 25,
//         qs: 3,
//         avatar_url: null,
//       },
//     ]);

//     const q = lastQuery();
//     expect(q).toContain("WITH events AS (");
//     expect(q).toContain("FROM pv_events");
//     expect(q).toContain("WHERE ao_org_id = 111");
//     expect(q).toContain("ORDER BY posts DESC, qs DESC");
//   });

//   it("getUpcomingEvents queries pv_upcoming_events and limits to 50", async () => {
//     (queryBigQuery as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
//       [],
//     );

//     await getUpcomingEvents(40364);

//     const q = lastQuery();
//     expect(q).toContain("FROM pv_upcoming");
//     expect(q).toContain("WHERE ao_org_id = 40364");
//     expect(q).toContain("ORDER BY start_date ASC");
//     expect(q).toContain("LIMIT 50");
//   });
// });
