import { describe, it, expect } from "vitest";
import { paxQdEvent } from "./events";
import type { EventData, EventAttendance } from "@/lib/types";

function att(overrides: Partial<EventAttendance>): EventAttendance {
  return {
    id: 1,
    user_id: 1,
    f3_name: "Tester",
    home_region_id: 1,
    q_ind: false,
    coq_ind: false,
    avatar_url: null,
    isBot: false,
    attended: true,
    ghost: false,
    fartsack: false,
    ...overrides,
  };
}

function event(attendance: EventAttendance[]): EventData {
  return { attendance } as unknown as EventData;
}

describe("paxQdEvent — #115 As Q filter", () => {
  it("is true when the PAX is a Q on the event", () => {
    const ev = event([
      att({ user_id: 7, q_ind: true }),
      att({ user_id: 8, q_ind: false }),
    ]);
    expect(paxQdEvent(ev, 7)).toBe(true);
  });

  it("is false when the PAX only attended (did not Q)", () => {
    const ev = event([
      att({ user_id: 7, q_ind: false }),
      att({ user_id: 8, q_ind: true }),
    ]);
    expect(paxQdEvent(ev, 7)).toBe(false);
  });

  it("does not count a co-Q as a Q", () => {
    const ev = event([att({ user_id: 7, q_ind: false, coq_ind: true })]);
    expect(paxQdEvent(ev, 7)).toBe(false);
  });

  it("is false when the PAX did not attend at all", () => {
    const ev = event([att({ user_id: 8, q_ind: true })]);
    expect(paxQdEvent(ev, 7)).toBe(false);
  });
});
