"use client";

import { useState } from "react";
import { Select, SelectItem } from "@heroui/select";
import { Pagination } from "@heroui/pagination";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";

import { Card, CardHeader, CardBody } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { RegionData } from "@/types/region";
import { formatDate, cleanEventName, formatNumber } from "@/lib/utils";
import { Link } from "@heroui/link";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";

function toUTCDate(dateStr: string | Date | number | null | undefined): number {
  if (!dateStr) return 0;

  // If already a Date instance
  if (dateStr instanceof Date) {
    return Date.UTC(dateStr.getUTCFullYear(), dateStr.getUTCMonth(), dateStr.getUTCDate());
  }

  // If it's a number (timestamp)
  if (typeof dateStr === "number") {
    const d = new Date(dateStr);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  // Ensure we are dealing with a string
  const str = String(dateStr);

  // Expecting YYYY-MM-DD
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return 0; // invalid date

  return Date.UTC(y, m - 1, d);
}

export function RegionEventsCard({ events }: { events: RegionData[] }) {
  events = events.toReversed(); // Show most recent events first

  const perPage = 10;
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [aoFilter, setAoFilter] = useState("any");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const aoOptions = [
    { key: "any", label: "Any AO" },
    ...Array.from(new Set(events.map((ev) => ev.ao_name)))
      .filter(Boolean)
      .sort()
      .map((name) => ({
        key: name,
        label: name,
      })),
  ];

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

    // AO filter match
    const matchesAoFilter = aoFilter === "any" || ev.ao_name === aoFilter;

    // Date range filter
    const evDate = toUTCDate(ev.event_date);
    const afterStart =
      !startDate || evDate >= toUTCDate(startDate);
    const beforeEnd =
      !endDate || evDate <= toUTCDate(endDate);
    const matchesDate = afterStart && beforeEnd;

    return matchesFree && matchesAoFilter && matchesDate;
  });

  const totalPages = Math.ceil(filteredEvents.length / perPage);
  const paginatedEvents = filteredEvents.slice((page - 1) * perPage, page * perPage);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center font-semibold text-xl px-6">
        <div className="flex items-center justify-between w-full">
          {/* Left: Title */}
          <div className="flex items-center justify-start">Recent Events</div>

          {/* Middle: Pagination */}
          <div className="flex items-center justify-center">
            {events.length > 0 && (
              <Pagination
                page={page}
                total={totalPages}
                onChange={setPage}
                showShadow
                size="sm"
                color="default"
                variant="bordered"
              />
            )}
          </div>

          {/* Right: Filters button */}
          <div className="flex items-center justify-end">
            <Popover placement="bottom-end">
              <PopoverTrigger>
                <Button variant="ghost">Search</Button>
              </PopoverTrigger>
              <PopoverContent className="p-4 w-64 flex flex-col gap-4">
                <Input
                  label="Search Events"
                  variant="bordered"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />

                {/* Search by AO */}
                <Select
                  items={aoOptions}
                  label="Filter by AO"
                  variant="bordered"
                  selectedKeys={[aoFilter]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as string;
                    setAoFilter(val);
                    setPage(1);
                  }}
                >
                  {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                </Select>

                {/* Date Range */}
                <Input
                  label="From Date"
                  type="date"
                  variant="bordered"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                />
                <Input
                  label="To Date"
                  type="date"
                  variant="bordered"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                />
                <Button
                  color="danger"
                  variant="flat"
                  onPress={() => {
                    setSearchTerm("");
                    setAoFilter("any");
                    setStartDate("");
                    setEndDate("");
                    setPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              </PopoverContent>
            </Popover>
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
                <Card className="bg-background/60 dark:bg-default-100/50 border border-default-200 dark:border-default-300">
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
                                  color="default"
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
    </Card>
  );
}
