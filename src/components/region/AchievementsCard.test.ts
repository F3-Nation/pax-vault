import { describe, it, expect } from "vitest";
import { computeAchievements } from "./AchievementsCard";
import type { RegionAchievementPax } from "@/lib/types";

/** ISO date string `days` ago from now. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** ISO date string `days` from now. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makePax(
  overrides: Partial<RegionAchievementPax>,
): RegionAchievementPax {
  return {
    user_id: 1,
    f3_name: "Tester",
    region_posts: 99,
    region_qs: 50,
    all_posts: 99,
    all_qs: 50,
    next_region_post_milestone: 100,
    next_nation_post_milestone: 100,
    next_region_q_milestone: null,
    next_nation_q_milestone: null,
    fng_date: null,
    next_anniversary_date: null,
    days_until_anniversary: null,
    last_region_event_date: daysAgo(1),
    ...overrides,
  };
}

describe("computeAchievements — #119 inactivity gate", () => {
  it("shows a post milestone for an active PAX 1 away", () => {
    const rows = computeAchievements(
      [makePax({ last_region_event_date: daysAgo(5) })],
      "region",
    );
    expect(rows.some((r) => r.type === "posts")).toBe(true);
  });

  it("hides post/Q milestones for a PAX inactive >90 days", () => {
    const rows = computeAchievements(
      [makePax({ last_region_event_date: daysAgo(120) })],
      "region",
    );
    expect(rows.some((r) => r.type === "posts" || r.type === "qs")).toBe(false);
  });

  it("hides post/Q milestones when the PAX has never posted in-region", () => {
    const rows = computeAchievements(
      [makePax({ last_region_event_date: null })],
      "region",
    );
    expect(rows).toHaveLength(0);
  });

  it("still shows the Manniversary for an inactive PAX (exempt from the gate)", () => {
    const rows = computeAchievements(
      [
        makePax({
          last_region_event_date: daysAgo(400),
          fng_date: "2018-06-01",
          next_anniversary_date: inDays(5),
          days_until_anniversary: 5,
          region_posts: 99,
        }),
      ],
      "region",
    );
    expect(rows.map((r) => r.type)).toEqual(["anniversary"]);
  });
});
