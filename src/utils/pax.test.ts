import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSummary, getAOBreakdown, getPaxCharting } from "./pax";
import { PaxData, PaxEventData } from "@/types/pax";
import { MOCK_PAX_LIST, MOCK_PAX_EVENTS } from "@/lib/data/mock";

// Helper to create PaxData from mock data
function createPaxDataFromMock(userId: number): PaxData | null {
  const paxInfo = MOCK_PAX_LIST.find((pax) => pax.user_id === userId);
  const events = MOCK_PAX_EVENTS[userId] || [];

  if (!paxInfo) return null;

  return {
    info: paxInfo,
    events: [...events], // Copy to avoid mutations
  };
}

describe("getSummary", () => {
  it("works with mock data", () => {
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    expect(summary).not.toBeNull();
    expect(summary!.event_count).toBeGreaterThan(0);
    expect(summary!.event_count).toBe(data!.events.length);
  });

  it("returns summary with correct event count", () => {
    const data = createPaxDataFromMock(1); // Andy Taylor has 2 events
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    expect(summary).not.toBeNull();
    expect(summary!.event_count).toBe(2);
  });

  it("calculates Q count correctly", () => {
    // Andy Taylor Q'd one event (The Murph at The Courthouse)
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    expect(summary!.q_count).toBe(1); // Andy Q'd The Murph event
  });

  it("identifies bestie correctly", () => {
    // Andy Taylor attended events with Barney Fife - Barney should be his bestie
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    // Barney Fife (user_id 2) appears with Andy in events
    expect(summary!.bestie_user_id).toBe(2);
    expect(summary!.bestie_count).toBeGreaterThan(0);
    expect(summary!.bestie_f3_name).toBe("Barney Fife");
  });

  it("counts unique users met", () => {
    // Andy Taylor has events with Barney Fife
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    expect(summary!.unique_users_met).toBeGreaterThan(0); // At least Barney Fife
  });

  it("handles empty events array", () => {
    // Use a user with no events - create data manually for this edge case
    const data: PaxData = {
      info: MOCK_PAX_LIST[3] || MOCK_PAX_LIST[0], // Gomer Pyle or first pax
      events: [],
    };
    const summary = getSummary(data);

    expect(summary!.event_count).toBe(0);
    expect(summary!.q_count).toBe(0);
    expect(summary!.first_event_date).toBeNull();
    expect(summary!.last_event_date).toBeNull();
    expect(summary!.bestie_user_id).toBeNull();
  });

  it("sets first and last event info", () => {
    // Andy Taylor's first event is The Murph at The Courthouse, last is Bootcamp at Wally's Filling Station
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    expect(summary!.first_event_ao_name).toBe("The Courthouse");
    expect(summary!.last_event_ao_name).toBe("Wally's Filling Station");
  });

  it("tracks first and last Q info", () => {
    // Andy Taylor Q'd The Murph at The Courthouse (his only Q event)
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    expect(summary!.first_q_ao_name).toBe("The Courthouse");
    expect(summary!.last_q_ao_name).toBe("The Courthouse");
  });

  it("counts unique pax when Q", () => {
    // Andy Taylor Q'd The Murph event which had Barney Fife in attendance
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const summary = getSummary(data!);

    // When Andy Q'd The Murph, Barney Fife was in attendance
    expect(summary!.unique_pax_when_q).toBe(1); // Barney Fife
  });
});

describe("getAOBreakdown", () => {
  it("works with mock data", () => {
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const breakdown = getAOBreakdown(data!);

    expect(breakdown).toBeDefined();
    expect(Array.isArray(breakdown)).toBe(true);
    // User 1 has events at multiple AOs (The Courthouse, Wally's Filling Station) in mock data
    expect(breakdown.length).toBeGreaterThan(0);
  });

  it("aggregates events by AO", () => {
    // Andy Taylor has events at The Courthouse and Wally's Filling Station
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const breakdown = getAOBreakdown(data!);

    expect(breakdown.length).toBe(2);

    const courthouse = breakdown.find((ao) => ao.ao_org_id === 201);
    const wallys = breakdown.find((ao) => ao.ao_org_id === 202);

    expect(courthouse?.total_events).toBe(1);
    expect(courthouse?.ao_name).toBe("The Courthouse");
    expect(wallys?.total_events).toBe(1);
    expect(wallys?.ao_name).toBe("Wally's Filling Station");
  });

  it("counts Q appearances per AO", () => {
    // Andy Taylor Q'd at The Courthouse once
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const breakdown = getAOBreakdown(data!);

    const courthouse = breakdown.find((ao) => ao.ao_org_id === 201);
    expect(courthouse?.total_q_count).toBe(1);
  });

  it("only counts events user attended", () => {
    // Create a scenario where user doesn't attend one event
    const mainUser = 1;
    const events: PaxEventData[] = [
      {
        ...MOCK_PAX_EVENTS[1][0], // The Murph event with Andy
        attendance: [
          {
            id: 1,
            user_id: mainUser,
            f3_name: "Andy Taylor",
            q_ind: true,
            coq_ind: false,
            avatar_url: null,
          },
          {
            id: 2,
            user_id: 2,
            f3_name: "Barney Fife",
            q_ind: false,
            coq_ind: false,
            avatar_url: null,
          },
        ],
      },
      {
        ...MOCK_PAX_EVENTS[2][0], // Barney's Ruck event - Andy didn't attend
        attendance: [
          {
            id: 3,
            user_id: 2,
            f3_name: "Barney Fife",
            q_ind: true,
            coq_ind: false,
            avatar_url: null,
          },
        ],
      },
    ];
    const data: PaxData = {
      info: MOCK_PAX_LIST[0], // Andy Taylor
      events,
    };

    const breakdown = getAOBreakdown(data);

    // Should only count The Courthouse where Andy attended
    expect(breakdown.find((ao) => ao.ao_org_id === 201)?.total_events).toBe(1);
  });

  it("returns empty array for no events", () => {
    // Use Gomer Pyle who has no events
    const data: PaxData = {
      info: MOCK_PAX_LIST[3], // Gomer Pyle
      events: [],
    };
    const breakdown = getAOBreakdown(data);
    expect(breakdown).toEqual([]);
  });

  it("includes region info in breakdown", () => {
    // Andy Taylor's events are in Mayberry
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const breakdown = getAOBreakdown(data!);

    expect(breakdown[0].region_org_id).toBe(101);
    expect(breakdown[0].region_name).toBe("Mayberry");
  });
});

describe("getPaxCharting", () => {
  // Mock the current date to ensure consistent testing
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("works with mock data", () => {
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const insights = getPaxCharting(data!);

    expect(insights).toBeDefined();
    expect(insights.paxData).toBeDefined();
    expect(Array.isArray(insights.paxData)).toBe(true);
    expect(typeof insights.eventsChange).toBe("number");
    expect(typeof insights.qsChange).toBe("number");
  });

  it("groups events by month", () => {
    // Andy Taylor has 2 events in January (2024-01-15 and 2024-01-22)
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const insights = getPaxCharting(data!);

    const jan = insights.paxData.find((d) => d.month === "Jan 2024");

    expect(jan?.events).toBe(2); // The Murph and Bootcamp both in January
  });

  it("counts Q appearances per month", () => {
    // Andy Taylor Q'd once in January (The Murph on 2024-01-15)
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const insights = getPaxCharting(data!);

    const jan = insights.paxData.find((d) => d.month === "Jan 2024");
    expect(jan?.qs).toBe(1);
  });

  it("fills missing months with zeros", () => {
    // Create a scenario with events in Jan and Mar to test missing Feb
    const mainUser = 1;
    const andyTaylor = MOCK_PAX_LIST[0];
    const events: PaxEventData[] = [
      {
        ...MOCK_PAX_EVENTS[1][0],
        event_date: "2024-01-15",
        attendance: [
          {
            id: 1,
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
            q_ind: false,
            coq_ind: false,
            avatar_url: null,
          },
        ],
      },
      {
        ...MOCK_PAX_EVENTS[1][0],
        event_instance_id: 9999,
        event_date: "2024-03-15",
        attendance: [
          {
            id: 2,
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
            q_ind: false,
            coq_ind: false,
            avatar_url: null,
          },
        ],
      },
    ];
    const data: PaxData = {
      info: andyTaylor,
      events,
    };

    const insights = getPaxCharting(data);

    const feb = insights.paxData.find((d) => d.month === "Feb 2024");
    expect(feb?.events).toBe(0);
    expect(feb?.qs).toBe(0);
  });

  it("calculates positive events change", () => {
    // Create scenario with multiple months for change calculation
    const mainUser = 1;
    const andyTaylor = MOCK_PAX_LIST[0];
    const baseEvent = MOCK_PAX_EVENTS[1][0];
    const events: PaxEventData[] = [
      {
        ...baseEvent,
        event_instance_id: 9001,
        event_date: "2024-03-15",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9002,
        event_date: "2024-04-15",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9003,
        event_date: "2024-04-20",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9004,
        event_date: "2024-05-15",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9005,
        event_date: "2024-05-20",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9006,
        event_date: "2024-05-25",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9007,
        event_date: "2024-06-10",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9008,
        event_date: "2024-06-11",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9009,
        event_date: "2024-06-12",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 9010,
        event_date: "2024-06-13",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
    ];
    const data: PaxData = {
      info: andyTaylor,
      events,
    };

    const insights = getPaxCharting(data);

    // June has 4 events, May has 3 = (4-3)/3 * 100 = 33.33%
    expect(insights.eventsChange).toBeCloseTo(33.33, 1);
  });

  it("returns 0 for changes when less than 4 data points", () => {
    // Create scenario with only 2 months of data
    const mainUser = 1;
    const andyTaylor = MOCK_PAX_LIST[0];
    const baseEvent = MOCK_PAX_EVENTS[1][0];
    const events: PaxEventData[] = [
      {
        ...baseEvent,
        event_instance_id: 8001,
        event_date: "2024-05-15",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
      {
        ...baseEvent,
        event_instance_id: 8002,
        event_date: "2024-06-15",
        attendance: [
          {
            ...baseEvent.attendance[0],
            user_id: mainUser,
            f3_name: andyTaylor.f3_name,
          },
        ],
      },
    ];
    const data: PaxData = {
      info: andyTaylor,
      events,
    };

    const insights = getPaxCharting(data);

    expect(insights.eventsChange).toBe(0);
    expect(insights.qsChange).toBe(0);
  });

  it("returns empty paxData for no events", () => {
    // Use Gomer Pyle who has no events
    const data: PaxData = {
      info: MOCK_PAX_LIST[3], // Gomer Pyle
      events: [],
    };
    const insights = getPaxCharting(data);

    expect(insights.paxData).toEqual([]);
    expect(insights.eventsChange).toBe(0);
    expect(insights.qsChange).toBe(0);
  });

  it("sorts data chronologically", () => {
    // Andy Taylor's events are already in chronological order in mock data
    const data = createPaxDataFromMock(1);
    expect(data).not.toBeNull();

    const insights = getPaxCharting(data!);

    // Events are from January 2024, so first should be Jan 2024
    const firstMonth = insights.paxData[0]?.month;
    expect(firstMonth).toContain("Jan 2024");
  });
});
