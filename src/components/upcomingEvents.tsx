"use client";

/**
 * UpcomingEventsCard
 *
 * Displays a scrollable list of upcoming events for a region.
 *
 * Features:
 * - Toggle to show only events with an open Q spot
 * - Visual distinction between open vs assigned Qs
 * - Links to AO and PAX detail pages
 *
 * This component is client-side and purely presentational.
 */

import { useState } from "react";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { EventUpcoming } from "@/lib/types";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { formatDate, formatTime } from "@/lib/utils";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Link } from "@heroui/link";
import { Button } from "@heroui/button";

function hasOpenQ(event: EventUpcoming) {
  return !event.q_list || event.q_list.length < 1;
}

type UpcomingEventsCardProps = {
  events: EventUpcoming[];
  filters?: string;
};

export function UpcomingEventsCard({
  events,
  filters,
}: UpcomingEventsCardProps) {
  // Toggle to filter events with open Q spots only
  const [showOpenOnly, setShowOpenOnly] = useState(false);

  // Apply open-Q filter when enabled
  const filteredEvents = showOpenOnly
    ? events.filter((e) => hasOpenQ(e))
    : events;

  // Count of events that currently have no assigned Q
  const openCount = events.filter((e) => hasOpenQ(e)).length;

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="font-semibold text-xl">Upcoming Events</div>

          <Button
            size="md"
            variant="bordered"
            color="default"
            isDisabled={openCount === 0}
            onPress={() => setShowOpenOnly((v) => !v)}
          >
            <span className={showOpenOnly ? "text-default-500" : "text-danger"}>
              {showOpenOnly ? "Show all" : "Show open only"}
            </span>
          </Button>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {/* Scroll container to cap card height while keeping header visible */}
        <ScrollShadow className="max-h-[60vh] lg:max-h-[32rem]">
          <div className="space-y-1 text-sm">
            {/* Empty state when filtering open-Q events */}
            {showOpenOnly && filteredEvents.length === 0 ? (
              <div className="italic text-default-500 text-sm">
                No upcoming events have an open Q spot.
              </div>
            ) : null}
            {filteredEvents.map((event, idx) => (
              <div
                key={`${event.start_date}-${event.ao_org_id}-${idx}`}
                className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
              >
                <div className="flex flex-col gap-1">
                  <div>
                    <Link
                      className="font-medium text-sm"
                      color="primary"
                      href={`/stats/ao/${event.ao_org_id}${filters ? `?${filters}` : ""}`}
                    >
                      {event.ao_name}
                    </Link>
                    {event.location_name ? (
                      <>
                        <div className="inline text-default-500 text-sm">
                          {" "}
                          at{" "}
                        </div>
                        <div className="inline text-default-500 text-sm italic">
                          {event.location_name ? ` ${event.location_name}` : ""}
                        </div>
                      </>
                    ) : (
                      ""
                    )}
                  </div>
                  <div className="text-default-500 text-sm">
                    {formatDate(event.start_date)}
                    {" @ "}
                    {formatTime(event.start_time)} •{" "}
                    <div className="inline text-default-500 text-sm italic">
                      {event.event_name}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-end">
                    {event.q_list.length > 0 ? (
                      <Link
                        key={`q-${event.ao_org_id}-${idx}`}
                        href={`/stats/pax/${event.q_list[0].user_id}${filters ? `?${filters}` : ""}`}
                        className="text-default-100"
                      >
                        <Chip
                          key={`q-${event.ao_org_id}-${idx}`}
                          avatar={
                            <Avatar
                              showFallback
                              src={event.q_list[0].avatar_url || undefined}
                            />
                          }
                          variant="bordered"
                          color="secondary"
                          size="sm"
                        >
                          {event.q_list[0].f3_name}
                        </Chip>
                      </Link>
                    ) : (
                      <Chip
                        key={`open-${event.ao_org_id}-${idx}`}
                        variant="bordered"
                        color="danger"
                        size="sm"
                      >
                        OPEN
                      </Chip>
                    )}
                  </div>
                  <div className="flex justify-end text-default-500 text-sm italic">
                    {event.event_type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
