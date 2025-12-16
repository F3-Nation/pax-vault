import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSummary, getLeaderboards } from "./region";
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
