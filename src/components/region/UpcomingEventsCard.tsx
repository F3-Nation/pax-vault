"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { RegionUpcomingEvents } from "@/types/region";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { formatDate, formatTime } from "@/lib/utils";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Link } from "@heroui/link";

export function UpcomingEventsCard({
  events,
}: {
  events: RegionUpcomingEvents[];
}) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6">
        <div className="flex items-center justify-between w-full">
          <div className="font-semibold text-xl">Upcoming Events</div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow className="h-[500px]">
          <div className="space-y-1 text-sm">
            {events.map((event, idx) => (
              <div
                key={`${event.start_date}-${event.ao_org_id}-${idx}`}
                className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
              >
                <div className="flex flex-col gap-1">
                  <div>
                    <Link
                      className="font-medium text-sm"
                      color="primary"
                      href={`/stats/ao/${event.ao_org_id}`}
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
                    {formatDate(event.start_date, "M D Y")}
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
                        href={`/stats/pax/${event.q_list[0].user_id}`}
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
