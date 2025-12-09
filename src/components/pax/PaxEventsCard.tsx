"use client";

import { useState } from "react";
import { Pagination } from "@heroui/pagination";
import { Input } from "@heroui/input";

import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { PaxEventData } from "@/types/pax";
import { formatDate, cleanEventName, formatNumber } from "@/lib/utils";
import { Link } from "@heroui/link";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";

export function PaxEventsCard({ events, thisUserId }: { events: PaxEventData[], thisUserId?: number }) {
  events = events.toReversed(); // Show most recent events first

  const perPage = 10;
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEvents = events.filter((ev) => {
    const term = searchTerm.toLowerCase();
    const name = ev.event_name?.toLowerCase() || "";
    const ao = ev.ao_name?.toLowerCase() || "";
    const region = ev.region_name?.toLowerCase() || "";

    const paxNames = ev.attendance
      .map((a) => a.f3_name?.toLowerCase() || "")
      .join(" ");

    const qNames = ev.attendance
      .filter((a) => a.q_ind)
      .map((a) => a.f3_name?.toLowerCase() || "")
      .join(" ");

    // Free text match
    const matchesFree =
      name.includes(term) ||
      ao.includes(term) ||
      region.includes(term) ||
      paxNames.includes(term) ||
      qNames.includes(term);

    return matchesFree;
  });

  const totalPages = Math.ceil(filteredEvents.length / perPage);
  const paginatedEvents = filteredEvents.slice((page - 1) * perPage, page * perPage);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center font-semibold text-xl px-6">
        <div className="flex items-center justify-between w-full">
          {/* Left: Title */}
          <div className="flex items-center justify-start">Recent Events</div>

          {/* Right: Search Input */}
          <div className="flex items-center justify-end">
            <Input
              aria-label="Search events"
              placeholder="Search events..."
              variant="flat"
              size="sm"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <div
          className={`grid grid-cols-1 gap-6 w-full max-w-6xl ${
            events.length > 0 ? "mb-6 lg:grid-cols-2" : ""
          }`}
        >
          {/* Event items will go here */}
          {events.length === 0 ? (
            <p className="italic text-center text-sm text-default">
              No events available
            </p>
          ) : null}
          {paginatedEvents.map((event, index) => {
            const pax_list = event.attendance
              .slice()
              .sort((a, b) => a.f3_name.localeCompare(b.f3_name));

            const q_list = event.attendance
              .filter((att) => att.q_ind)
              .slice()
              .sort((a, b) => a.f3_name.localeCompare(b.f3_name));
            return (
              <div key={event.event_instance_id || index}>
                <Card
                  className={`bg-background/60 dark:bg-default-100/50 border ${q_list.some(q => q.user_id === thisUserId) ? "border-secondary" : "border-default-200 dark:border-default-300"}`}
                >
                  <CardBody className="text-sm">
                    <div className="flex justify-between gap-4">
                      <div className="pb-4 justify-start">
                        <Link href={`/stats/event/${event.event_instance_id}`}>
                          <div className="font-semibold text-primary text-lg">
                            {cleanEventName(event.event_name)}
                          </div>
                        </Link>
                        <div className="text-default-400">
                          {formatDate(event.event_date, "M D Y")} @{" "}
                          <Link
                            href={
                              event.ao_org_id
                                ? `/stats/ao/${event.ao_org_id}`
                                : `/stats/region/${event.region_org_id}`
                            }
                          >
                            <span className="text-default-400 text-sm italic">
                              {event.ao_name ?? event.region_name}
                            </span>
                          </Link>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Chip>{formatNumber(event.pax_count)}</Chip>
                      </div>
                    </div>
                    <div className="flex justify-between gap-2 pb-2">
                      <div className="flex flex-wrap gap-1">
                        {q_list.length === 0 ? (
                          <Chip
                            key={`q-unknown-${event.event_instance_id}`}
                            avatar={<Avatar showFallback src={undefined} />}
                            variant="bordered"
                            color="secondary"
                            size="sm"
                          >
                            Unknown Q
                          </Chip>
                        ) : (
                          q_list.map((q, i) => {
                            return (
                              <Link
                                key={`q-${event.event_instance_id}-${i}`}
                                href={`/stats/pax/${q.user_id}`}
                                className="text-default-100"
                              >
                                <Chip
                                  key={`q-${event.event_instance_id}-${i}`}
                                  avatar={
                                    <Avatar
                                      showFallback
                                      src={q.avatar_url || undefined}
                                    />
                                  }
                                  variant="bordered"
                                  color="secondary"
                                  size="sm"
                                >
                                  {q.f3_name}
                                </Chip>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between pb-2">
                      <div className="flex flex-wrap gap-1">
                        {pax_list.length === 0 ? (
                          <span className="italic text-default-500">
                            No attendees
                          </span>
                        ) : (
                          pax_list.map((pax, i) => {
                            return (
                              <Link
                                key={`pax-${event.event_instance_id}-${i}`}
                                href={`/stats/pax/${pax.user_id}`}
                                className="text-default-100"
                              >
                                <Chip
                                  key={`pax-${event.event_instance_id}-${i}`}
                                  avatar={
                                    <Avatar
                                      showFallback
                                      src={pax.avatar_url || undefined}
                                    />
                                  }
                                  variant="bordered"
                                  color={"default"}
                                  size="sm"
                                >
                                  {pax.f3_name}
                                </Chip>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            );
          })}
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-center items-center font-semibold text-xl px-6">
        {/* Middle: Pagination */}
        {events.length > 0 && (
          <Pagination
            page={page}
            total={totalPages}
            onChange={setPage}
            showShadow
            showControls
            color="default"
            variant="bordered"
          />
        )}
      </CardFooter>
    </Card>
  );
}
