import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSummary, getLeaderboards, getChartData } from "./ao";

import { EventData, EventAttendance } from "../lib/types";

// ---------- Helpers ----------

function createAttendance(
  userId: number,
  f3Name: string,
  qInd: boolean = false,
  avatarUrl: string | null = null
): EventAttendance {
  return {
    id: userId * 100,
    user_id: userId,
    f3_name: f3Name,
    q_ind: qInd,
    coq_ind: false,
    avatar_url: avatarUrl,
    home_region_id: 1,
    isBot: false,
  };
}

function createAOEvent(
  eventId: number,
  eventDate: string,
  aoOrgId: number,
  aoName: string,
  attendance: EventAttendance[],
  fngCount: number = 0
): EventData {
  return {
    event_instance_id: eventId,
    event_date: eventDate,
    event_name: `Event ${eventId}`,
    pax_count: attendance.length,
    fng_count: fngCount,
    ao_org_id: aoOrgId,
    ao_name: aoName,
    region_org_id: 1,
    region_name: "Test Region",
    region_logo_url: null,
    sector_org_id: 1,
    sector_name: "Test Sector",
    area_org_id: 1,
    area_name: "Test Area",
    first_f_ind: "1",
    second_f_ind: "0",
    third_f_ind: "0",
    tags: null,
    types: null,
    attendance,
  };
}

// ---------- getSummary ----------

describe("AO getSummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for empty data", () => {
    expect(getSummary([])).toBeNull();
  });

  it("counts total events", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getSummary(data);
    expect(result!.event_count).toBe(2);
  });

  it("calculates first_event_date from earliest event", () => {
    const data = [
      createAOEvent(1, "2024-06-10", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createAOEvent(2, "2024-06-01", 100, "AO1", [
        createAttendance(2, "User2"),
      ]),
    ];

    const result = getSummary(data);
    expect(result!.first_event_date).toBe("Mon, Jun 10 2024"); // relies on incoming sort order
  });

  it("counts active pax in last 30 days", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-05-01", 100, "AO1", [
        createAttendance(3, "User3"),
      ]),
    ];

    const result = getSummary(data);
    expect(result!.active_pax).toBe(2);
  });

  it("counts unique pax", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(3, "User3"),
      ]),
    ];

    const result = getSummary(data);
    expect(result!.unique_pax).toBe(3);
  });

  it("counts unique Qs", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", true),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1", true),
        createAttendance(3, "User3", true),
      ]),
    ];

    const result = getSummary(data);
    expect(result!.unique_qs).toBe(2);
  });

  it("sums FNG count", () => {
    const data = [
      createAOEvent(
        1,
        "2024-06-01",
        100,
        "AO1",
        [createAttendance(1, "User1")],
        2
      ),
      createAOEvent(
        2,
        "2024-06-02",
        100,
        "AO1",
        [createAttendance(1, "User1")],
        3
      ),
    ];

    const result = getSummary(data);
    expect(result!.fng_count).toBe(5);
  });

  it("calculates average pax per event", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getSummary(data);
    expect(result!.pax_count_average).toBe(1.5);
  });
});

// ---------- getLeaderboards ----------

describe("AO getLeaderboards", () => {
  it("returns empty array for empty data", () => {
    expect(getLeaderboards([])).toEqual([]);
  });

  it("counts posts per user", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getLeaderboards(data);

    const user1 = result!.find((u) => u.user_id === 1);
    const user2 = result!.find((u) => u.user_id === 2);

    expect(user1!.posts).toBe(2);
    expect(user2!.posts).toBe(1);
  });

  it("counts Q appearances", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", true),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1", true),
        createAttendance(2, "User2", true),
      ]),
    ];

    const result = getLeaderboards(data);

    const user1 = result!.find((u) => u.user_id === 1);
    const user2 = result!.find((u) => u.user_id === 2);

    expect(user1!.qs).toBe(2);
    expect(user2!.qs).toBe(1);
  });

  it("sorts by posts descending", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
      createAOEvent(2, "2024-06-02", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
      createAOEvent(3, "2024-06-03", 100, "AO1", [
        createAttendance(1, "User1"),
      ]),
    ];

    const result = getLeaderboards(data);

    expect(result![0].user_id).toBe(1);
    expect(result![0].posts).toBe(3);
  });

  it("includes avatar_url when present", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", false, "https://example.com/avatar.jpg"),
      ]),
    ];

    const result = getLeaderboards(data);
    expect(result![0].avatar_url).toBe("https://example.com/avatar.jpg");
  });

  it("handles users without avatar_url", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1", false, null),
      ]),
    ];

    const result = getLeaderboards(data);
    expect(result![0].avatar_url).toBeUndefined();
  });
});

// ---------- getChartData (sanity) ----------

describe("AO getChartData", () => {
  it("returns null for empty data", () => {
    const result = getChartData([], undefined, undefined);
    expect(result).toEqual({ uniquePax: null, workoutAOCount: null });
  });

  it("returns uniquePax and workoutAOCount for valid data", () => {
    const data = [
      createAOEvent(1, "2024-06-01", 100, "AO1", [
        createAttendance(1, "User1"),
        createAttendance(2, "User2"),
      ]),
    ];

    const result = getChartData(data, undefined, undefined);

    expect(result).toBeDefined();
    expect(result!.uniquePax).toBeDefined();
    expect(result!.workoutAOCount).toBeDefined();
  });
});
