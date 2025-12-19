import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSummary, getLeaderboards, getKotterList } from "./region";
import { RegionData, RegionAttendance } from "@/types/region";

// Helper to create a mock attendance record
function createAttendance(
  userId: number,
  f3Name: string,
  qInd: boolean = false,
  avatarUrl: string | null = null,
): RegionAttendance {
  return {
    id: userId * 100,
    user_id: userId,
    f3_name: f3Name,
    q_ind: qInd,
    coq_ind: false,
    avatar_url: avatarUrl,
  };
}

// Helper to create a mock RegionData event
function createRegionEvent(
  eventId: number,
  eventDate: string,
  aoOrgId: number,
  aoName: string,
  attendance: RegionAttendance[],
  fngCount: number = 0,
): RegionData {
  return {
    event_instance_id: eventId,
    event_date: eventDate,
    event_name: `Event ${eventId}`,
    pax_count: attendance.length,
    fng_count: fngCount,
    location_id: 1,
    location_name: "Test Location",
    location_latitude: 35.0,
    location_longitude: -80.0,
    ao_org_id: aoOrgId,
    ao_name: aoName,
    region_org_id: 1,
    region_name: "Test Region",
    region_logo_url: null,
    sector_org_id: 1,
    sector_name: "Test Sector",
    all_types: null,
    all_tags: null,
    attendance,
  };
}

describe("getSummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for empty data", () => {
    const result = getSummary([]);
    expect(result).toBeNull();
  });

  it("counts total events", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(3, "2024-06-03", 200, "AO2", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getSummary(data);

    expect(result!.event_count).toBe(3);
  });

  it("counts unique AOs", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(3, "2024-06-03", 200, "AO2", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(4, "2024-06-04", 300, "AO3", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getSummary(data);

    expect(result!.ao_count).toBe(3);
  });

  it("counts active pax within last 30 days", () => {
    const data = [
      // Within last 30 days (from June 15)
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      // Outside 30 days
      createRegionEvent(2, "2024-05-01", 100, "AO1", [
        createAttendance(3, "User3"), // Should not be counted as active
      ]),
    ];

    const result = getSummary(data);

    expect(result!.active_pax).toBe(2); // Only User1 and User2
  });

  it("counts unique pax across all events", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"), // Same user
        createAttendance(3, "User3"), // New user
      ]),
    ];

    const result = getSummary(data);

    expect(result!.unique_pax).toBe(3);
  });

  it("counts unique Qs", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", true), // Q
        createAttendance(2, "User2", false),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1", true), // Same Q
        createAttendance(3, "User3", true), // New Q
      ]),
    ];

    const result = getSummary(data);

    expect(result!.unique_qs).toBe(2);
  });

  it("sums FNG count", () => {
    const data = [
      createRegionEvent(
        1,
        "2024-06-01",
        100,
        "AO1",
        [createAttendance(1, "User1")],
        2,
      ),
      createRegionEvent(
        2,
        "2024-06-02",
        100,
        "AO1",
        [createAttendance(1, "User1")],
        3,
      ),
    ];

    const result = getSummary(data);

    expect(result!.fng_count).toBe(5);
  });

  it("calculates average pax per event", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
      ]), // pax_count = 3
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]), // pax_count = 1
    ];

    const result = getSummary(data);

    expect(result!.pax_count_average).toBe(2); // (3 + 1) / 2
  });

  it("handles single event", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
    ];

    const result = getSummary(data);

    expect(result!.event_count).toBe(1);
    expect(result!.ao_count).toBe(1);
    expect(result!.unique_pax).toBe(2);
  });
});

describe("getLeaderboards", () => {
  it("returns empty array for empty data", () => {
    const result = getLeaderboards([]);
    expect(result).toEqual([]);
  });

  it("counts posts per user", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"), // User1 posts again
      ]),
    ];

    const result = getLeaderboards(data);

    const user1 = result!.find((l) => l.user_id === 1);
    const user2 = result!.find((l) => l.user_id === 2);

    expect(user1!.posts).toBe(2);
    expect(user2!.posts).toBe(1);
  });

  it("counts Q appearances per user", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", true), // Q
        createAttendance(2, "User2", false),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1", true), // Q again
        createAttendance(2, "User2", true), // Now Q
      ]),
    ];

    const result = getLeaderboards(data);

    const user1 = result!.find((l) => l.user_id === 1);
    const user2 = result!.find((l) => l.user_id === 2);

    expect(user1!.qs).toBe(2);
    expect(user2!.qs).toBe(1);
  });

  it("sorts by posts descending", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(3, "User3"),
      ]),
      createRegionEvent(3, "2024-06-03", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getLeaderboards(data);

    // User1 has 3 posts, User3 has 2, User2 has 1
    expect(result![0].user_id).toBe(1);
    expect(result![0].posts).toBe(3);
    expect(result![1].user_id).toBe(3);
    expect(result![1].posts).toBe(2);
    expect(result![2].user_id).toBe(2);
    expect(result![2].posts).toBe(1);
  });

  it("includes f3_name in results", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "Dredd"),
      ]),
    ];

    const result = getLeaderboards(data);

    expect(result![0].f3_name).toBe("Dredd");
  });

  it("includes avatar_url when present", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", false, "https://example.com/avatar.jpg"),
      ]),
    ];

    const result = getLeaderboards(data);

    expect(result![0].avatar_url).toBe("https://example.com/avatar.jpg");
  });

  it("handles user without avatar_url", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", false, null),
      ]),
    ];

    const result = getLeaderboards(data);

    expect(result![0].avatar_url).toBeUndefined();
  });

  it("handles many users across many events", () => {
    const data = [
      createRegionEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
        createAttendance(4, "User4"),
        createAttendance(5, "User5"),
      ]),
      createRegionEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
      ]),
      createRegionEvent(3, "2024-06-03", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getLeaderboards(data);

    expect(result!.length).toBe(5);
    expect(result![0].posts).toBe(3); // User1
    expect(result![1].posts).toBe(2); // User2 or User3
    expect(result![2].posts).toBe(2); // User2 or User3
    expect(result![3].posts).toBe(1); // User4 or User5
    expect(result![4].posts).toBe(1); // User4 or User5
  });
});

describe("getKotterList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for empty data", () => {
    expect(getKotterList([])).toBeNull();
  });

  it("returns null for null-ish data", () => {
    expect(getKotterList(null as unknown as RegionData[])).toBeNull();
  });

  it("excludes users who posted within last 14 days (active)", () => {
    // User posted 10 days ago - should be excluded (too recent)
    const data = [
      createRegionEvent(1, "2024-06-05", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result).toEqual([]);
  });

  it("excludes users who posted more than 90 days ago", () => {
    // User posted 100 days ago - should be excluded (too old)
    const data = [
      createRegionEvent(1, "2024-03-07", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result).toEqual([]);
  });

  it("includes users who posted between 14 and 90 days ago", () => {
    // User posted 20 days ago - should be included
    const data = [
      createRegionEvent(1, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(1);
    expect(result![0].user_id).toBe(1);
    expect(result![0].f3_name).toBe("User1");
    expect(result![0].days_since_last_event).toBe(20);
  });

  it("sorts results by days_since_last_event ascending", () => {
    const data = [
      // User1 posted 30 days ago
      createRegionEvent(1, "2024-05-16", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      // User2 posted 20 days ago
      createRegionEvent(2, "2024-05-26", 100, "AO1", [
        createAttendance(2, "User2"),
      ]),
      // User3 posted 40 days ago
      createRegionEvent(3, "2024-05-06", 100, "AO1", [
        createAttendance(3, "User3"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(3);
    expect(result![0].user_id).toBe(2); // 20 days
    expect(result![1].user_id).toBe(1); // 30 days
    expect(result![2].user_id).toBe(3); // 40 days
  });

  it("classifies 'New PAX Drop' status correctly", () => {
    // New PAX Drop: total <= 6 posts, days since last >= 14, first post within 90 days
    // User has 3 posts, last posted 20 days ago, first post 30 days ago
    const data = [
      createRegionEvent(1, "2024-05-16", 100, "AO1", [
        createAttendance(1, "NewPax"),
      ]),
      createRegionEvent(2, "2024-05-20", 100, "AO1", [
        createAttendance(1, "NewPax"),
      ]),
      createRegionEvent(3, "2024-05-26", 100, "AO1", [
        createAttendance(1, "NewPax"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(1);
    expect(result![0].kotter_status).toBe("New PAX Drop");
  });

  it("classifies 'Soft Drift' status correctly", () => {
    // Soft Drift: 7-99 total posts, days since last 21-45
    // User has 10 posts, last posted 25 days ago
    vi.setSystemTime(new Date("2024-06-15"));
    const events: RegionData[] = [];

    // Create 10 events spread over time, last one 25 days ago
    for (let i = 0; i < 10; i++) {
      const date = new Date("2024-01-01");
      date.setDate(date.getDate() + i * 10);
      events.push(
        createRegionEvent(i + 1, date.toISOString().slice(0, 10), 100, "AO1", [
          createAttendance(1, "DriftUser"),
        ]),
      );
    }
    // Last event 25 days ago (within 21-45 window)
    events.push(
      createRegionEvent(11, "2024-05-21", 100, "AO1", [
        createAttendance(1, "DriftUser"),
      ]),
    );

    const result = getKotterList(events);

    expect(result!.length).toBe(1);
    expect(result![0].kotter_status).toBe("Soft Drift");
  });

  it("classifies 'Inactive' status for users not matching other categories", () => {
    // User with first post > 90 days ago (not New PAX Drop),
    // 3 posts (not enough for Soft Drift which requires 7+),
    // last posted 50 days ago (outside Soft Drift 21-45 window anyway)
    const data = [
      createRegionEvent(1, "2024-02-01", 100, "AO1", [
        createAttendance(1, "InactiveUser"),
      ]),
      createRegionEvent(2, "2024-03-01", 100, "AO1", [
        createAttendance(1, "InactiveUser"),
      ]),
      createRegionEvent(3, "2024-04-26", 100, "AO1", [
        createAttendance(1, "InactiveUser"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(1);
    expect(result![0].kotter_status).toBe("Inactive");
  });

  it("tracks last event details correctly", () => {
    const data = [
      createRegionEvent(1, "2024-05-01", 100, "FirstAO", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(2, "2024-05-26", 200, "LastAO", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result![0].last_event_date).toBe("2024-05-26");
    expect(result![0].last_event_ao_org_id).toBe(200);
  });

  it("calculates bestie list from co-attendance", () => {
    // User1 and User2 attend together, User1 should have User2 as bestie
    const data = [
      createRegionEvent(1, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
      ]),
      createRegionEvent(2, "2024-05-27", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
    ];

    const result = getKotterList(data);

    // User1 posted 20 and 19 days ago, last was 19 days ago
    const user1 = result!.find((u) => u.user_id === 1);
    expect(user1).toBeDefined();
    expect(user1!.bestie_list).toBeDefined();
    expect(user1!.bestie_list.length).toBeGreaterThan(0);
    // User2 should be the top bestie (2 co-attendances)
    expect(user1!.bestie_list[0].user_id).toBe(2);
    expect(user1!.bestie_list[0].co_attendance_count).toBe(2);
  });

  it("limits bestie list to top 3", () => {
    // Create scenario with multiple co-attendees
    const data = [
      createRegionEvent(1, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
        createAttendance(4, "User4"),
        createAttendance(5, "User5"),
      ]),
    ];

    const result = getKotterList(data);

    const user1 = result!.find((u) => u.user_id === 1);
    expect(user1!.bestie_list.length).toBeLessThanOrEqual(3);
  });

  it("includes avatar_url when present", () => {
    const data = [
      createRegionEvent(1, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1", false, "https://example.com/avatar.jpg"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result![0].avatar_url).toBe("https://example.com/avatar.jpg");
  });

  it("handles user without avatar_url", () => {
    const data = [
      createRegionEvent(1, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1", false, null),
      ]),
    ];

    const result = getKotterList(data);

    expect(result![0].avatar_url).toBeUndefined();
  });

  it("tracks first_event_date correctly", () => {
    const data = [
      createRegionEvent(1, "2024-04-01", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(2, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result![0].first_event_date).toBe("2024-04-01");
  });

  it("counts total_events correctly", () => {
    const data = [
      createRegionEvent(1, "2024-05-01", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(2, "2024-05-15", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createRegionEvent(3, "2024-05-26", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getKotterList(data);

    expect(result![0].total_events).toBe(3);
  });

  it("preserves empty f3_name when provided", () => {
    // The code uses ?? operator which only replaces null/undefined, not empty string
    const data = [
      createRegionEvent(1, "2024-05-26", 100, "AO1", [
        {
          id: 100,
          user_id: 1,
          f3_name: "",
          q_ind: false,
          coq_ind: false,
          avatar_url: null,
        },
      ]),
    ];

    const result = getKotterList(data);

    expect(result![0].f3_name).toBe("");
  });
});
