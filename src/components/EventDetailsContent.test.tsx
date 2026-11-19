import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EventDetailsBody,
  eventDetailsIdentity,
  eventDetailsUrl,
} from "./EventDetailsContent";
import type { EventData } from "@/lib/types";

const event = {
  event_instance_id: 42,
  event_name: "Morning workout",
  event_date: "2026-10-12",
  attendance: [{ user_id: 7, f3_name: "Trail Mix", q_ind: true }],
  fartsacks: [],
} as unknown as EventData;

describe("EventDetailsBody while details are deferred", () => {
  it("adds the release token only when core data provides one", () => {
    expect(eventDetailsUrl(42)).toBe("/api/events/42");
    expect(eventDetailsUrl(42, "lease /+token")).toBe(
      "/api/events/42?releaseId=lease+%2F%2Btoken",
    );
  });

  it("treats event id and release token as the detail state identity", () => {
    expect(
      eventDetailsIdentity({ event_instance_id: 42, eventReleaseId: "one" }),
    ).not.toBe(
      eventDetailsIdentity({ event_instance_id: 42, eventReleaseId: "two" }),
    );
    expect(eventDetailsIdentity({ event_instance_id: 42 })).not.toBe(
      eventDetailsIdentity({ event_instance_id: 43 }),
    );
    expect(eventDetailsIdentity({ event_instance_id: 42 })).toBe("[42,null]");
    expect(
      eventDetailsIdentity({ event_instance_id: 42, eventReleaseId: "legacy" }),
    ).not.toBe(eventDetailsIdentity({ event_instance_id: 42 }));
  });

  it("keeps the core roster in the initial server markup and shows detail placeholders", () => {
    const markup = renderToStaticMarkup(
      createElement(EventDetailsBody, {
        event,
        details: null,
        isLoadingDetails: true,
      }),
    );

    expect(markup).toContain("Trail Mix");
    expect(markup).toContain("Loading event photos and write-ups");
    expect(markup).toContain("Preblast loading");
    expect(markup).not.toContain("No preblast provided.");
    expect(markup).not.toContain("No backblast provided.");
  });

  it("keeps the roster and distinguishes unavailable details from empty details", () => {
    const markup = renderToStaticMarkup(
      createElement(EventDetailsBody, {
        event,
        details: null,
        detailsError: "Event details are temporarily unavailable.",
      }),
    );

    expect(markup).toContain("Trail Mix");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Preblast unavailable.");
    expect(markup).not.toContain("No preblast provided.");
  });

  it("shows a refresh action instead of retry for a stale release", () => {
    const markup = renderToStaticMarkup(
      createElement(EventDetailsBody, {
        event,
        details: null,
        detailsError: "This event has changed since the page loaded.",
        refreshRequired: true,
        onRetry: () => undefined,
        onRefresh: () => undefined,
      }),
    );
    expect(markup).toContain("Refresh page");
    expect(markup).not.toContain("Try again");
    expect(markup).toContain("Trail Mix");
  });
});
