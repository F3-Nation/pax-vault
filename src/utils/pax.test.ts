import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSummary, getAOBreakdown, getPaxCharting } from "./pax";
import { PaxData, PaxEventData, PaxAttendance } from "@/types/pax";

// Helper to create a mock attendance record
function createAttendance(
  userId: number,
  f3Name: string,
  qInd: boolean = false,
): PaxAttendance {
  return {
    id: userId * 100,
    user_id: userId,
    f3_name: f3Name,
    q_ind: qInd,
    coq_ind: false,
    avatar_url: null,
  };
}

// Helper to create a mock event
function createEvent(
  eventId: number,
  eventDate: string,
  aoOrgId: number,
  aoName: string,
  attendance: PaxAttendance[],
): PaxEventData {
  return {
    event_instance_id: eventId,
    event_date: eventDate,
    event_name: `Event ${eventId}`,
    pax_count: attendance.length,
    fng_count: 0,
    ao_org_id: aoOrgId,
    ao_name: aoName,
    region_org_id: 1,
    region_name: "Test Region",
    first_f_ind: "Y",
    second_f_ind: "N",
    third_f_ind: "N",
    attendance,
  };
}

// Helper to create PaxData
function createPaxData(
  userId: number,
  f3Name: string,
  events: PaxEventData[],
): PaxData {
  return {
    info: {
      user_id: userId,
      f3_name: f3Name,
      region: "Test Region",
      region_id: 1,
      region_default: "Test Region",
      region_default_id: 1,
      avatar_url: null,
      status: "active",
    },
    events,
  };
}

describe("getSummary", () => {
  it("returns summary with correct event count", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(2, "OtherPax"),
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary).not.toBeNull();
    expect(summary!.event_count).toBe(2);
  });

  it("calculates Q count correctly", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Q event
        createAttendance(2, "OtherPax"),
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(mainUser, "TestPax", false), // Not Q
      ]),
      createEvent(3, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Q event
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary!.q_count).toBe(2);
  });

  it("identifies bestie correctly", () => {
    const mainUser = 1;
    const bestieId = 3;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(2, "User2"),
        createAttendance(bestieId, "Bestie"),
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(bestieId, "Bestie"), // Bestie appears again
      ]),
      createEvent(3, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(bestieId, "Bestie"), // Bestie appears again
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary!.bestie_user_id).toBe(bestieId);
    expect(summary!.bestie_count).toBe(3);
    expect(summary!.bestie_f3_name).toBe("Bestie");
  });

  it("counts unique users met", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(2, "User2"), // Same user
        createAttendance(4, "User4"), // New user
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary!.unique_users_met).toBe(3); // Users 2, 3, 4
  });

  it("handles empty events array", () => {
    const data = createPaxData(1, "TestPax", []);
    const summary = getSummary(data);

    expect(summary!.event_count).toBe(0);
    expect(summary!.q_count).toBe(0);
    expect(summary!.first_event_date).toBeNull();
    expect(summary!.last_event_date).toBeNull();
    expect(summary!.bestie_user_id).toBeNull();
  });

  it("sets first and last event info", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "FirstAO", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-06-15", 200, "LastAO", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary!.first_event_ao_name).toBe("FirstAO");
    expect(summary!.last_event_ao_name).toBe("LastAO");
  });

  it("tracks first and last Q info", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax", false),
      ]),
      createEvent(2, "2024-02-01", 100, "FirstQAO", [
        createAttendance(mainUser, "TestPax", true), // First Q
      ]),
      createEvent(3, "2024-03-01", 200, "LastQAO", [
        createAttendance(mainUser, "TestPax", true), // Last Q
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary!.first_q_ao_name).toBe("FirstQAO");
    expect(summary!.last_q_ao_name).toBe("LastQAO");
  });

  it("counts unique pax when Q", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Q event
        createAttendance(2, "User2"),
        createAttendance(3, "User3"),
      ]),
      createEvent(2, "2024-02-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Another Q event
        createAttendance(2, "User2"), // Same user
        createAttendance(4, "User4"), // New user
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const summary = getSummary(data);

    expect(summary!.unique_pax_when_q).toBe(3); // Users 2, 3, 4
  });
});

describe("getAOBreakdown", () => {
  it("aggregates events by AO", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(3, "2024-01-15", 200, "AO2", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const breakdown = getAOBreakdown(data);

    expect(breakdown.length).toBe(2);

    const ao1 = breakdown.find((ao) => ao.ao_org_id === 100);
    const ao2 = breakdown.find((ao) => ao.ao_org_id === 200);

    expect(ao1?.total_events).toBe(2);
    expect(ao2?.total_events).toBe(1);
  });

  it("counts Q appearances per AO", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Q
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(mainUser, "TestPax", false), // Not Q
      ]),
      createEvent(3, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Q
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const breakdown = getAOBreakdown(data);

    expect(breakdown[0].total_q_count).toBe(2);
  });

  it("only counts events user attended", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
        createAttendance(2, "OtherPax"),
      ]),
      createEvent(2, "2024-01-08", 100, "AO1", [
        createAttendance(2, "OtherPax"), // Main user didn't attend
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const breakdown = getAOBreakdown(data);

    expect(breakdown[0].total_events).toBe(1);
  });

  it("returns empty array for no events", () => {
    const data = createPaxData(1, "TestPax", []);
    const breakdown = getAOBreakdown(data);
    expect(breakdown).toEqual([]);
  });

  it("includes region info in breakdown", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-01", 100, "TestAO", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const breakdown = getAOBreakdown(data);

    expect(breakdown[0].region_org_id).toBe(1);
    expect(breakdown[0].region_name).toBe("Test Region");
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

  it("groups events by month", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-01-20", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(3, "2024-02-10", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const insights = getPaxCharting(data);

    const jan = insights.paxData.find((d) => d.month === "Jan 2024");
    const feb = insights.paxData.find((d) => d.month === "Feb 2024");

    expect(jan?.events).toBe(2);
    expect(feb?.events).toBe(1);
  });

  it("counts Q appearances per month", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax", true), // Q
      ]),
      createEvent(2, "2024-01-20", 100, "AO1", [
        createAttendance(mainUser, "TestPax", false), // Not Q
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const insights = getPaxCharting(data);

    const jan = insights.paxData.find((d) => d.month === "Jan 2024");
    expect(jan?.qs).toBe(1);
  });

  it("fills missing months with zeros", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-03-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const insights = getPaxCharting(data);

    const feb = insights.paxData.find((d) => d.month === "Feb 2024");
    expect(feb?.events).toBe(0);
    expect(feb?.qs).toBe(0);
  });

  it("calculates positive events change", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-03-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-04-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(3, "2024-04-20", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(4, "2024-05-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(5, "2024-05-20", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(6, "2024-05-25", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(7, "2024-06-10", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(8, "2024-06-11", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(9, "2024-06-12", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(10, "2024-06-13", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const insights = getPaxCharting(data);

    // June has 4 events, May has 3 = (4-3)/3 * 100 = 33.33%
    expect(insights.eventsChange).toBeCloseTo(33.33, 1);
  });

  it("returns 0 for changes when less than 4 data points", () => {
    const mainUser = 1;
    const events = [
      createEvent(1, "2024-05-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-06-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const insights = getPaxCharting(data);

    expect(insights.eventsChange).toBe(0);
    expect(insights.qsChange).toBe(0);
  });

  it("returns empty paxData for no events", () => {
    const data = createPaxData(1, "TestPax", []);
    const insights = getPaxCharting(data);

    expect(insights.paxData).toEqual([]);
    expect(insights.eventsChange).toBe(0);
    expect(insights.qsChange).toBe(0);
  });

  it("sorts data chronologically", () => {
    const mainUser = 1;
    const events = [
      createEvent(3, "2024-03-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(1, "2024-01-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
      createEvent(2, "2024-02-15", 100, "AO1", [
        createAttendance(mainUser, "TestPax"),
      ]),
    ];
    const data = createPaxData(mainUser, "TestPax", events);

    const insights = getPaxCharting(data);

    // First should be Jan, last should be current month (June)
    expect(insights.paxData[0].month).toBe("Jan 2024");
  });
});
