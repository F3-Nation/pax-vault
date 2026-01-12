import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSummary, getLeaderboards, getKotterList } from "./region";
import { RegionData, RegionAttendance } from "@/types/region";
import { MOCK_REGION_EVENTS, MOCK_PAX_LIST } from "@/lib/data/mock";

// Helper to get region data from mock data
function getRegionDataFromMock(regionId: number): RegionData[] {
  const events = MOCK_REGION_EVENTS[regionId] || [];
  // Copy to avoid mutations
  return events.map((event) => ({
    ...event,
    attendance: event.attendance ? [...event.attendance] : [],
  }));
}

// Helper to create a RegionData event using mock data structure (for edge case testing)
function createRegionEvent(
  eventId: number,
  eventDate: string,
  aoOrgId: number,
  aoName: string,
  attendance: RegionAttendance[],
  fngCount: number = 0
): RegionData {
  // Use Mayberry region data from mock as base
  const baseEvent = MOCK_REGION_EVENTS[101][0];
  return {
    ...baseEvent,
    event_instance_id: eventId,
    event_date: eventDate,
    event_name: baseEvent.event_name || `Event ${eventId}`,
    pax_count: attendance.length,
    fng_count: fngCount,
    ao_org_id: aoOrgId,
    ao_name: aoName,
    attendance,
  };
}

// Helper to create attendance using mock data character names
function createAttendance(
  userId: number,
  f3Name?: string,
  qInd: boolean = false,
  avatarUrl: string | null = null
): RegionAttendance {
  // Use mock character name if f3Name not provided
  const paxInfo = MOCK_PAX_LIST.find((p) => p.user_id === userId);
  const name = f3Name || paxInfo?.f3_name || `User${userId}`;

  return {
    id: userId * 100,
    user_id: userId,
    f3_name: name,
    q_ind: qInd,
    coq_ind: false,
    avatar_url: avatarUrl,
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

  it("works with mock data", () => {
    const data = getRegionDataFromMock(101);
    expect(data.length).toBeGreaterThan(0);

    const result = getSummary(data);

    expect(result).not.toBeNull();
    expect(result!.event_count).toBeGreaterThan(0);
    expect(result!.unique_pax).toBeGreaterThan(0);
    expect(result!.ao_count).toBeGreaterThan(0);
  });

  it("returns null for empty data", () => {
    const result = getSummary([]);
    expect(result).toBeNull();
  });

  it("counts total events", () => {
    // Use mock data which has 6 events for Mayberry
    const data = getRegionDataFromMock(101);

    const result = getSummary(data);

    expect(result!.event_count).toBe(6);
  });

  it("counts unique AOs", () => {
    // Mock data has events at The Courthouse, Wally's Filling Station, and Myers Lake (3 unique AOs)
    const data = getRegionDataFromMock(101);

    const result = getSummary(data);

    expect(result!.ao_count).toBe(3);
  });

  it("counts active pax within last 30 days", () => {
    // Create custom scenario with events within and outside 30 days
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      // Within last 30 days (from June 15)
      {
        ...baseEvent,
        event_instance_id: 2001,
        event_date: "2024-06-01",
        attendance: [
          createAttendance(1), // Andy Taylor
          createAttendance(2), // Barney Fife
        ],
      },
      // Outside 30 days
      {
        ...baseEvent,
        event_instance_id: 2002,
        event_date: "2024-05-01",
        attendance: [
          createAttendance(3), // Opie Taylor - should not be counted as active
        ],
      },
    ];

    const result = getSummary(data);

    expect(result!.active_pax).toBe(2); // Only Andy and Barney
  });

  it("counts unique pax across all events", () => {
    // Mock data has 7 unique pax: Andy Taylor, Barney Fife, Opie Taylor, Floyd Lawson, Ellie Walker, Aunt Bee, Thelma Lou
    const data = getRegionDataFromMock(101);

    const result = getSummary(data);

    // Mayberry has 7 unique pax across events
    expect(result!.unique_pax).toBe(7);
  });

  it("counts unique Qs", () => {
    // Mock data has Andy Taylor as Q in first event, and Ellie Walker as Q in third event, so 2 unique Qs
    const data = getRegionDataFromMock(101);

    const result = getSummary(data);

    expect(result!.unique_qs).toBe(2); // Andy Taylor and Ellie Walker
  });

  it("sums FNG count", () => {
    // Mock data has fng_count: 2 + 1 + 1 + 0 + 0 + 0 = 4 total for Mayberry
    const data = getRegionDataFromMock(101);

    const result = getSummary(data);

    expect(result!.fng_count).toBe(4); // 2 + 1 + 1 + 0 + 0 + 0
  });

  it("calculates average pax per event", () => {
    // Mock data has pax_count: 12, 15, 10, 12, 10, 12 = average of (12 + 15 + 10 + 12 + 10 + 12) / 6 = 11.833...
    const data = getRegionDataFromMock(101);

    const result = getSummary(data);

    expect(result!.pax_count_average).toBeCloseTo(11.833, 2); // (12 + 15 + 10 + 12 + 10 + 12) / 6
  });

  it("handles single event", () => {
    // Create a single event using mock data structure
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 3001,
        event_date: "2024-06-01",
        attendance: [
          createAttendance(1), // Andy Taylor
          createAttendance(2), // Barney Fife
        ],
      },
    ];

    const result = getSummary(data);

    expect(result!.event_count).toBe(1);
    expect(result!.ao_count).toBe(1);
    expect(result!.unique_pax).toBe(2);
  });
});

describe("getLeaderboards", () => {
  it("works with mock data", () => {
    const data = getRegionDataFromMock(101);
    expect(data.length).toBeGreaterThan(0);

    const result = getLeaderboards(data);

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    expect(result!.length).toBeGreaterThan(0);
    // Should be sorted by posts descending
    if (result!.length > 1) {
      expect(result![0].posts).toBeGreaterThanOrEqual(result![1].posts);
    }
  });

  it("returns empty array for empty data", () => {
    const result = getLeaderboards([]);
    expect(result).toEqual([]);
  });

  it("counts posts per user", () => {
    // Andy Taylor appears in 3 events, Barney Fife appears in multiple, Opie in first
    const data = getRegionDataFromMock(101);

    const result = getLeaderboards(data);

    const andy = result!.find((l) => l.user_id === 1);
    const barney = result!.find((l) => l.user_id === 2);
    const opie = result!.find((l) => l.user_id === 3);

    expect(andy!.posts).toBe(3); // Andy in 3 events
    expect(barney!.posts).toBeGreaterThanOrEqual(2); // Barney in multiple events
    expect(opie!.posts).toBe(1); // Opie in first event only
  });

  it("counts Q appearances per user", () => {
    // Andy Taylor Q'd The Murph event (1 Q), Barney and Opie did not Q
    const data = getRegionDataFromMock(101);

    const result = getLeaderboards(data);

    const andy = result!.find((l) => l.user_id === 1);
    const barney = result!.find((l) => l.user_id === 2);

    expect(andy!.qs).toBe(1); // Andy Q'd The Murph
    expect(barney!.qs).toBe(0); // Barney did not Q
  });

  it("sorts by posts descending", () => {
    // Create scenario with multiple posts using mock data structure
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 4001,
        event_date: "2024-06-01",
        attendance: [
          createAttendance(1), // Andy - 3 posts total
          createAttendance(2), // Barney - 1 post total
          createAttendance(3), // Opie - 2 posts total
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 4002,
        event_date: "2024-06-02",
        attendance: [
          createAttendance(1), // Andy
          createAttendance(3), // Opie
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 4003,
        event_date: "2024-06-03",
        attendance: [
          createAttendance(1), // Andy
        ],
      },
    ];

    const result = getLeaderboards(data);

    // Andy has 3 posts, Opie has 2, Barney has 1
    expect(result![0].user_id).toBe(1);
    expect(result![0].posts).toBe(3);
    expect(result![1].user_id).toBe(3);
    expect(result![1].posts).toBe(2);
    expect(result![2].user_id).toBe(2);
    expect(result![2].posts).toBe(1);
  });

  it("includes f3_name in results", () => {
    // Use mock data which includes character names
    const data = getRegionDataFromMock(101);

    const result = getLeaderboards(data);

    const andy = result!.find((l) => l.user_id === 1);
    expect(andy!.f3_name).toBe("Andy Taylor");
  });

  it("includes avatar_url when present", () => {
    // Create event with avatar URL using mock data structure
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 5001,
        event_date: "2024-06-01",
        attendance: [
          createAttendance(
            1,
            undefined,
            false,
            "https://example.com/avatar.jpg"
          ),
        ],
      },
    ];

    const result = getLeaderboards(data);

    expect(result![0].avatar_url).toBe("https://example.com/avatar.jpg");
  });

  it("handles user without avatar_url", () => {
    // Mock data has null avatar_urls
    const data = getRegionDataFromMock(101);

    const result = getLeaderboards(data);

    expect(result![0].avatar_url).toBeUndefined();
  });

  it("handles many users across many events", () => {
    // Create scenario with multiple users using mock character names
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 6001,
        event_date: "2024-06-01",
        attendance: [
          createAttendance(1), // Andy - 3 posts
          createAttendance(2), // Barney - 2 posts
          createAttendance(3), // Opie - 2 posts
          createAttendance(4), // Gomer - 1 post
          createAttendance(5), // Otis - 1 post
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 6002,
        event_date: "2024-06-02",
        attendance: [
          createAttendance(1), // Andy
          createAttendance(2), // Barney
          createAttendance(3), // Opie
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 6003,
        event_date: "2024-06-03",
        attendance: [
          createAttendance(1), // Andy
        ],
      },
    ];

    const result = getLeaderboards(data);

    expect(result!.length).toBe(5);
    expect(result![0].posts).toBe(3); // Andy
    expect(result![1].posts).toBe(2); // Barney or Opie
    expect(result![2].posts).toBe(2); // Barney or Opie
    expect(result![3].posts).toBe(1); // Gomer or Otis
    expect(result![4].posts).toBe(1); // Gomer or Otis
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

  it("works with mock data for Mayberry - should have PAX in KotterList", () => {
    // Mayberry (region 101) should have PAX in KotterList
    // Floyd Lawson last posted 25 days ago (2024-05-21) - within 14-90 day range
    // Aunt Bee last posted 30 days ago (2024-05-16) - within 14-90 day range
    const data = getRegionDataFromMock(101);
    expect(data.length).toBeGreaterThan(0);

    const result = getKotterList(data);

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // Floyd Lawson and Aunt Bee should be in the list
    const floyd = result!.find((u) => u.user_id === 6);
    const auntBee = result!.find((u) => u.user_id === 7);
    expect(floyd).toBeDefined();
    expect(floyd!.f3_name).toBe("Floyd Lawson");
    expect(floyd!.days_since_last_event).toBe(25); // 2024-05-21 to 2024-06-15
    expect(auntBee).toBeDefined();
    expect(auntBee!.f3_name).toBe("Aunt Bee");
    expect(auntBee!.days_since_last_event).toBe(30); // 2024-05-16 to 2024-06-15
  });

  it("works with mock data for Mount Pilot - should have PAX in KotterList", () => {
    // Mount Pilot (region 102) should have PAX in KotterList
    // Howard Sprague last posted 45 days ago (2024-05-01) - within 14-90 day range
    const data = getRegionDataFromMock(102);
    expect(data.length).toBeGreaterThan(0);

    const result = getKotterList(data);

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // Howard Sprague should be in the list
    const howard = result!.find((u) => u.user_id === 11);
    expect(howard).toBeDefined();
    expect(howard!.f3_name).toBe("Howard Sprague");
    expect(howard!.days_since_last_event).toBe(45); // 2024-05-01 to 2024-06-15
  });

  it("works with mock data for Silver City - should have PAX in KotterList", () => {
    // Silver City (region 104) should have PAX in KotterList
    // The Lone Ranger last posted 18 days ago (2024-05-28) - within 14-90 day range
    const data = getRegionDataFromMock(104);
    expect(data.length).toBeGreaterThan(0);

    const result = getKotterList(data);

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // The Lone Ranger should be in the list
    const loneRanger = result!.find((u) => u.user_id === 14);
    expect(loneRanger).toBeDefined();
    expect(loneRanger!.f3_name).toBe("The Lone Ranger");
    expect(loneRanger!.days_since_last_event).toBe(18); // 2024-05-28 to 2024-06-15
  });

  it("works with mock data for Colby - should have PAX in KotterList", () => {
    // Colby (region 105) should have PAX in KotterList
    // Dan Reid last posted 34 days ago (2024-05-12) - within 14-90 day range
    const data = getRegionDataFromMock(105);
    expect(data.length).toBeGreaterThan(0);

    const result = getKotterList(data);

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // Dan Reid should be in the list
    const danReid = result!.find((u) => u.user_id === 17);
    expect(danReid).toBeDefined();
    expect(danReid!.f3_name).toBe("Dan Reid");
    expect(danReid!.days_since_last_event).toBe(34); // 2024-05-12 to 2024-06-15
  });

  it("works with mock data for Dry Gulch - should have PAX in KotterList", () => {
    // Dry Gulch (region 106) should have PAX in KotterList
    // Ranger Clayton last posted 43 days ago (2024-05-03) - within 14-90 day range
    const data = getRegionDataFromMock(106);
    expect(data.length).toBeGreaterThan(0);

    const result = getKotterList(data);

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // Ranger Clayton should be in the list
    const rangerClayton = result!.find((u) => u.user_id === 18);
    expect(rangerClayton).toBeDefined();
    expect(rangerClayton!.f3_name).toBe("Ranger Clayton");
    expect(rangerClayton!.days_since_last_event).toBe(43); // 2024-05-03 to 2024-06-15
  });

  it("works with mock data for Siler's City - should be empty", () => {
    // Siler's City (region 103) should be empty (no events)
    const data = getRegionDataFromMock(103);

    const result = getKotterList(data);

    expect(result).toBeNull(); // Empty data returns null
  });

  it("returns null for null-ish data", () => {
    expect(getKotterList(null as unknown as RegionData[])).toBeNull();
  });

  it("excludes users who posted within last 14 days (active)", () => {
    // User posted 10 days ago - should be excluded (too recent)
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7001,
        event_date: "2024-06-05",
        attendance: [
          createAttendance(1), // Andy Taylor
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result).toEqual([]);
  });

  it("excludes users who posted more than 90 days ago", () => {
    // User posted 100 days ago - should be excluded (too old)
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7002,
        event_date: "2024-03-07",
        attendance: [
          createAttendance(1), // Andy Taylor
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result).toEqual([]);
  });

  it("includes users who posted between 14 and 90 days ago", () => {
    // User posted 20 days ago - should be included
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7003,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(1), // Andy Taylor
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(1);
    expect(result![0].user_id).toBe(1);
    expect(result![0].f3_name).toBe("Andy Taylor");
    expect(result![0].days_since_last_event).toBe(20);
  });

  it("sorts results by days_since_last_event ascending", () => {
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      // Andy posted 30 days ago
      {
        ...baseEvent,
        event_instance_id: 7004,
        event_date: "2024-05-16",
        attendance: [
          createAttendance(1), // Andy Taylor
        ],
      },
      // Barney posted 20 days ago
      {
        ...baseEvent,
        event_instance_id: 7005,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(2), // Barney Fife
        ],
      },
      // Opie posted 40 days ago
      {
        ...baseEvent,
        event_instance_id: 7006,
        event_date: "2024-05-06",
        attendance: [
          createAttendance(3), // Opie Taylor
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(3);
    expect(result![0].user_id).toBe(2); // Barney - 20 days
    expect(result![1].user_id).toBe(1); // Andy - 30 days
    expect(result![2].user_id).toBe(3); // Opie - 40 days
  });

  it("classifies 'New PAX Drop' status correctly", () => {
    // New PAX Drop: total <= 6 posts, days since last >= 14, first post within 90 days
    // User has 3 posts, last posted 20 days ago, first post 30 days ago
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7007,
        event_date: "2024-05-16",
        attendance: [
          createAttendance(4), // Gomer Pyle - 3 posts total
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7008,
        event_date: "2024-05-20",
        attendance: [
          createAttendance(4), // Gomer
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7009,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(4), // Gomer - last post 20 days ago
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(1);
    expect(result![0].kotter_status).toBe("New PAX Drop");
    expect(result![0].f3_name).toBe("Gomer Pyle");
  });

  it("classifies 'Soft Drift' status correctly", () => {
    // Soft Drift: 7-99 total posts, days since last 21-45
    // User has 10 posts, last posted 25 days ago
    vi.setSystemTime(new Date("2024-06-15"));
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const events: RegionData[] = [];

    // Create 10 events spread over time, last one 25 days ago
    for (let i = 0; i < 10; i++) {
      const date = new Date("2024-01-01");
      date.setDate(date.getDate() + i * 10);
      events.push({
        ...baseEvent,
        event_instance_id: 8000 + i,
        event_date: date.toISOString().slice(0, 10),
        attendance: [
          createAttendance(1), // Andy Taylor
        ],
      });
    }
    // Last event 25 days ago (within 21-45 window)
    events.push({
      ...baseEvent,
      event_instance_id: 8010,
      event_date: "2024-05-21",
      attendance: [
        createAttendance(1), // Andy Taylor
      ],
    });

    const result = getKotterList(events);

    expect(result!.length).toBe(1);
    expect(result![0].kotter_status).toBe("Soft Drift");
    expect(result![0].f3_name).toBe("Andy Taylor");
  });

  it("classifies 'Inactive' status for users not matching other categories", () => {
    // User with first post > 90 days ago (not New PAX Drop),
    // 3 posts (not enough for Soft Drift which requires 7+),
    // last posted 50 days ago (outside Soft Drift 21-45 window anyway)
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7010,
        event_date: "2024-02-01",
        attendance: [
          createAttendance(5), // Otis Campbell
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7011,
        event_date: "2024-03-01",
        attendance: [
          createAttendance(5), // Otis
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7012,
        event_date: "2024-04-26",
        attendance: [
          createAttendance(5), // Otis - last post 50 days ago
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result!.length).toBe(1);
    expect(result![0].kotter_status).toBe("Inactive");
    expect(result![0].f3_name).toBe("Otis Campbell");
  });

  it("tracks last event details correctly", () => {
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7013,
        event_date: "2024-05-01",
        ao_org_id: 201,
        ao_name: "The Courthouse",
        attendance: [
          createAttendance(1), // Andy Taylor
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7014,
        event_date: "2024-05-26",
        ao_org_id: 202,
        ao_name: "Wally's Filling Station",
        attendance: [
          createAttendance(1), // Andy - last event
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result![0].last_event_date).toBe("2024-05-26");
    expect(result![0].last_event_ao_org_id).toBe(202);
    expect(result![0].last_event_ao_name).toBe("Wally's Filling Station");
  });

  it("calculates bestie list from co-attendance", () => {
    // Andy and Barney attend together, Andy should have Barney as bestie
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7015,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(1), // Andy Taylor
          createAttendance(2), // Barney Fife
          createAttendance(3), // Opie Taylor
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7016,
        event_date: "2024-05-27",
        attendance: [
          createAttendance(1), // Andy
          createAttendance(2), // Barney
        ],
      },
    ];

    const result = getKotterList(data);

    // Andy posted 20 and 19 days ago
    const andy = result!.find((u) => u.user_id === 1);
    expect(andy).toBeDefined();
    expect(andy!.bestie_list).toBeDefined();
    expect(andy!.bestie_list.length).toBeGreaterThan(0);
    // Barney should be the top bestie (2 co-attendances)
    expect(andy!.bestie_list[0].user_id).toBe(2);
    expect(andy!.bestie_list[0].co_attendance_count).toBe(2);
    expect(andy!.bestie_list[0].f3_name).toBe("Barney Fife");
  });

  it("limits bestie list to top 3", () => {
    // Create scenario with multiple co-attendees using mock character names
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7017,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(1), // Andy Taylor
          createAttendance(2), // Barney Fife
          createAttendance(3), // Opie Taylor
          createAttendance(4), // Gomer Pyle
          createAttendance(5), // Otis Campbell
        ],
      },
    ];

    const result = getKotterList(data);

    const andy = result!.find((u) => u.user_id === 1);
    expect(andy!.bestie_list.length).toBeLessThanOrEqual(3);
  });

  it("includes avatar_url when present", () => {
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7018,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(
            1,
            undefined,
            false,
            "https://example.com/avatar.jpg"
          ),
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result![0].avatar_url).toBe("https://example.com/avatar.jpg");
  });

  it("handles user without avatar_url", () => {
    // Mock data has null avatar_urls
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7019,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(1), // Andy Taylor - no avatar
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result![0].avatar_url).toBeUndefined();
  });

  it("tracks first_event_date correctly", () => {
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7020,
        event_date: "2024-04-01",
        attendance: [
          createAttendance(1), // Andy Taylor - first event
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7021,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(1), // Andy - last event
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result![0].first_event_date).toBe("2024-04-01");
  });

  it("counts total_events correctly", () => {
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7022,
        event_date: "2024-05-01",
        attendance: [
          createAttendance(1), // Andy Taylor - 3 events total
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7023,
        event_date: "2024-05-15",
        attendance: [
          createAttendance(1), // Andy
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 7024,
        event_date: "2024-05-26",
        attendance: [
          createAttendance(1), // Andy
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result![0].total_events).toBe(3);
  });

  it("preserves empty f3_name when provided", () => {
    // The code uses ?? operator which only replaces null/undefined, not empty string
    const baseEvent = MOCK_REGION_EVENTS[101][0];
    const data: RegionData[] = [
      {
        ...baseEvent,
        event_instance_id: 7025,
        event_date: "2024-05-26",
        ao_name: "The Courthouse",
        attendance: [
          {
            id: 100,
            user_id: 1,
            f3_name: "",
            q_ind: false,
            coq_ind: false,
            avatar_url: null,
          },
        ],
      },
    ];

    const result = getKotterList(data);

    expect(result![0].f3_name).toBe("");
  });
});
