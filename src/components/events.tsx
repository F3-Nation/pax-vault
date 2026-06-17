"use client";

/**
 * EventsCard
 *
 * Displays a searchable, paginated list of events for a region.
 * Supports lazy-loading all events, client-side filtering, and
 * an event-details modal.
 *
 * This component is client-side and intentionally stateful.
 */

import { useEffect, useMemo, useState } from "react";
/**
 * Lightweight skeleton placeholder for event cards.
 *
 * Used when loading the full event history to provide a more visual loading state.
 */
function EventCardSkeleton() {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50 border border-default-200 dark:border-default-300">
      <CardBody className="text-sm">
        <div className="animate-pulse">
          <div className="flex justify-between gap-4">
            <div className="flex-1">
              <div className="h-5 w-3/4 rounded-md bg-default-200 dark:bg-default-300" />
              <div className="mt-2 h-4 w-2/3 rounded-md bg-default-100 dark:bg-default-200" />
            </div>
            <div className="h-8 w-24 rounded-md bg-default-100 dark:bg-default-200" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <div className="h-7 w-28 rounded-full bg-default-100 dark:bg-default-200" />
            <div className="h-7 w-24 rounded-full bg-default-100 dark:bg-default-200" />
            <div className="h-7 w-32 rounded-full bg-default-100 dark:bg-default-200" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <div className="h-7 w-20 rounded-full bg-default-100 dark:bg-default-200" />
            <div className="h-7 w-24 rounded-full bg-default-100 dark:bg-default-200" />
            <div className="h-7 w-28 rounded-full bg-default-100 dark:bg-default-200" />
            <div className="h-7 w-16 rounded-full bg-default-100 dark:bg-default-200" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
import { Pagination } from "@heroui/pagination";
import { Input } from "@heroui/input";

import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { EventData, EventDetails } from "@/lib/types";
import { formatDate, cleanEventName } from "@/lib/utils";
import { Link } from "@heroui/link";
import NextLink from "next/link";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { useDisclosure } from "@heroui/use-disclosure";
import { Button } from "@heroui/button";
import { Tab, Tabs } from "@heroui/tabs";
import {
  EventDetailsHeader,
  EventDetailsBody,
} from "@/components/EventDetailsContent";
import { CopyLinkButton } from "@/components/CopyLinkButton";

/**
 * True when `paxId` was a Q (q_ind) on this event. Single source of truth for
 * both the purple "I Q'd this" highlight and the PAX-page "As Q" filter
 * (issue #115). Exported for tests.
 */
export function paxQdEvent(event: EventData, paxId: number): boolean {
  return event.attendance.some((att) => att.q_ind && att.user_id === paxId);
}

type EventsCardProps = {
  events: EventData[];
  thisPaxId?: number;
  thisRegionId?: number;
  thisAOId?: number;
  filtersQuery?: string;
  filters?: string;
};

export function EventsCard({
  events,
  thisPaxId,
  thisRegionId,
  thisAOId,
  filtersQuery,
  filters,
}: EventsCardProps) {
  // Local copy of events (allows client-side filtering and reload-all behavior)
  const [eventsData, setEventsData] = useState<EventData[]>(() => events ?? []);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);

  useEffect(() => {
    setEventsData(events ?? []);
    setHasLoadedAll(false);
  }, [events]);

  // Pagination and search state
  const perPage = 10;
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // PAX-page "As PAX / As Q" view toggle (issue #115). Only meaningful when a
  // single PAX is in scope; ignored on region/AO pages where thisPaxId is unset.
  const [viewMode, setViewMode] = useState<"asPax" | "asQ">("asPax");

  // Per-event toggle for the attendee list, which is collapsed to a count on
  // mobile (where 20+ chips become an unreadable wall) and tap-to-expand.
  const [expandedPax, setExpandedPax] = useState<Set<number>>(new Set());
  const togglePax = (id: number) =>
    setExpandedPax((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Event details modal state
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!selectedEvent || !isOpen) return;

    let cancelled = false;

    async function fetchDetails() {
      try {
        setIsLoadingDetails(true);
        setEventDetails(null);

        const res = await fetch(
          `/api/events/${selectedEvent?.event_instance_id}`,
        );
        if (!res.ok) {
          throw new Error(`Failed to load event details (${res.status})`);
        }

        const data = await res.json();
        if (!cancelled) setEventDetails(data);
      } catch (err) {
        console.error("Error loading event details:", err);
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    }

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, isOpen]);

  /**
   * Load the full event history for the region, respecting current filters.
   */
  async function loadAllEvents() {
    if (isLoadingAll) return;

    try {
      setIsLoadingAll(true);

      const qs = filtersQuery ? filtersQuery.trim() : "";
      const urlType = thisRegionId
        ? `region/${thisRegionId}`
        : thisAOId
          ? `ao/${thisAOId}`
          : thisPaxId
            ? `pax/${thisPaxId}`
            : "";
      const url = qs
        ? `/api/${urlType}/events?${qs}`
        : `/api/${urlType}/events`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error("Failed to load all events:", res.statusText);
        return;
      }

      const data: EventData[] = await res.json();
      setEventsData(data ?? []);
      setPage(1);
      setHasLoadedAll(true);
    } catch (err) {
      console.error("Error loading all events:", err);
    } finally {
      setIsLoadingAll(false);
    }
  }

  // Switching to "As Q" filters down to a (usually small) subset, so pull the
  // full history first — otherwise the filter only sees the recent slice and an
  // older workout the PAX is hunting for would be missing.
  const handleViewModeChange = (mode: "asPax" | "asQ") => {
    setViewMode(mode);
    setPage(1);
    if (mode === "asQ" && !hasLoadedAll && !isLoadingAll) {
      void loadAllEvents();
    }
  };

  const sortAttendance = (list: (typeof events)[number]["attendance"]) =>
    list
      .slice()
      .sort((a, b) =>
        (a.f3_name ?? a.user_id.toString()).localeCompare(
          b.f3_name ?? b.user_id.toString(),
        ),
      );

  const getQList = (event: EventData) =>
    sortAttendance(event.attendance.filter((att) => att.q_ind));

  const getcoQList = (event: EventData) =>
    sortAttendance(event.attendance.filter((att) => att.coq_ind));

  const getPaxList = (event: EventData) => sortAttendance(event.attendance);

  // Client-side search across event, AO, region, PAX, and Q names, plus the
  // optional "As Q" gate that hides events this PAX did not Q (issue #115).
  const filteredEvents = eventsData.filter((ev) => {
    if (
      viewMode === "asQ" &&
      thisPaxId !== undefined &&
      !paxQdEvent(ev, thisPaxId)
    ) {
      return false;
    }

    const term = searchTerm.toLowerCase();
    const name = ev.event_name?.toLowerCase() || "";
    const ao = ev.ao_name?.toLowerCase() || "";
    const region = ev.region_name?.toLowerCase() || "";
    const tags = ev.tags?.map((tag) => tag.name.toLowerCase()).join(" ") || "";
    const types =
      ev.types?.map((type) => type.name.toLowerCase()).join(" ") || "";

    const paxNames = ev.attendance
      .map((a) => a.f3_name?.toLowerCase() || a.user_id.toString())
      .join(" ");

    const qNames = ev.attendance
      .filter((a) => a.q_ind)
      .map((a) => a.f3_name?.toLowerCase() || a.user_id.toString())
      .join(" ");

    return (
      name.includes(term) ||
      ao.includes(term) ||
      region.includes(term) ||
      paxNames.includes(term) ||
      qNames.includes(term) ||
      tags.includes(term) ||
      types.includes(term)
    );
  });

  // Pagination derived from filtered results
  const totalPages = Math.ceil(filteredEvents.length / perPage);
  const paginatedEvents = filteredEvents.slice(
    (page - 1) * perPage,
    page * perPage,
  );

  const skeletonCards = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i),
    [],
  );

  return (
    <>
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
        <CardHeader className="flex justify-between items-center font-semibold text-xl px-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center justify-start">Recent Events</div>

            <div className="flex items-center justify-end gap-2 flex-wrap">
              {thisPaxId !== undefined && (
                <Tabs
                  aria-label="Filter recent events by role"
                  selectedKey={viewMode}
                  onSelectionChange={(key) =>
                    handleViewModeChange(key as "asPax" | "asQ")
                  }
                  size="sm"
                  radius="sm"
                  variant="bordered"
                  color="secondary"
                >
                  <Tab key="asPax" title="As PAX" />
                  <Tab key="asQ" title="As Q" />
                </Tabs>
              )}
              {!hasLoadedAll && (
                <Button
                  onPress={loadAllEvents}
                  isDisabled={isLoadingAll}
                  variant="ghost"
                  color="default"
                  size="md"
                >
                  <span className="text-default-500">
                    {isLoadingAll ? "Loading…" : "Load all"}
                  </span>
                </Button>
              )}
              <Input
                aria-label="Search events"
                placeholder="Search events..."
                variant="flat"
                size="md"
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
              eventsData.length > 0 || isLoadingAll ? "mb-6 lg:grid-cols-2" : ""
            }`}
          >
            {isLoadingAll &&
              skeletonCards.map((i) => (
                <div key={`event-skeleton-${i}`}>
                  <EventCardSkeleton />
                </div>
              ))}

            {!isLoadingAll && eventsData.length === 0 ? (
              <p className="italic text-center text-sm text-default">
                No events available
              </p>
            ) : null}

            {!isLoadingAll &&
            eventsData.length > 0 &&
            filteredEvents.length === 0 ? (
              <p className="italic text-center text-sm text-default">
                {viewMode === "asQ" && thisPaxId !== undefined
                  ? "No Q'd events match this view"
                  : "No events match your search"}
              </p>
            ) : null}

            {!isLoadingAll &&
              paginatedEvents.map((event, index) => {
                const pax_list = getPaxList(event);
                const q_list = getQList(event);
                const coq_list = getcoQList(event);

                return (
                  <div key={event.event_instance_id || index}>
                    <Card
                      className={`bg-background/60 dark:bg-default-100/50 border ${
                        thisPaxId !== undefined && paxQdEvent(event, thisPaxId)
                          ? "border-secondary"
                          : "border-default-200 dark:border-default-300"
                      }`}
                    >
                      <CardBody className="text-sm">
                        <div className="flex justify-between gap-4">
                          <div className="pb-4 justify-start">
                            <div className="font-semibold text-primary text-lg">
                              {cleanEventName(event.event_name)}
                            </div>
                            <div className="text-default-400">
                              {formatDate(event.event_date)}
                              {event.ao_org_id != thisAOId && (
                                <>
                                  <span className="text-default-400"> @ </span>
                                  <Link
                                    href={
                                      event.ao_org_id
                                        ? `/stats/ao/${event.ao_org_id}${filters ? `?${filters}` : ""}`
                                        : `/stats/region/${event.region_org_id}${filters ? `?${filters}` : ""}`
                                    }
                                  >
                                    <span className="text-default-400 text-sm italic">
                                      {event.ao_name ??
                                        event.region_name ??
                                        "Unknown AO"}
                                    </span>
                                  </Link>
                                </>
                              )}

                              {event.region_org_id != thisRegionId && (
                                <>
                                  <span className="text-default-400 text-sm italic">
                                    {" "}
                                    •{" "}
                                  </span>
                                  <Link
                                    href={`/stats/region/${event.region_org_id}${filters ? `?${filters}` : ""}`}
                                  >
                                    <span className="text-default-400 text-sm italic">
                                      {"F3 " +
                                        (event.region_name ?? "Unknown Region")}
                                    </span>
                                  </Link>
                                </>
                              )}
                            </div>

                            <div className="gap-2t">
                              <span className="text-warning text-sm">
                                {event.tags?.map((tag) => tag.name).join(" • ")}
                              </span>
                              {(event.tags?.length ?? 0) > 0 &&
                                (event.types?.length ?? 0) > 0 && (
                                  <span className="text-default-400 italic text-sm">
                                    {" "}
                                    •{" "}
                                  </span>
                                )}
                              <span className="text-default-400 italic text-sm">
                                {event.types
                                  ?.map((type) => type.name)
                                  .join(" • ")}
                              </span>
                            </div>
                          </div>
                          <div className="gap-2 justify-end text-right">
                            <Button
                              onPress={() => {
                                setSelectedEvent(event);
                                onOpen();
                              }}
                              variant="ghost"
                              color="default"
                              size="sm"
                            >
                              View Details
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2 pb-2">
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
                              q_list.map((q, i) => (
                                <Link
                                  key={`q-${event.event_instance_id}-${i}`}
                                  href={`/stats/pax/${q.user_id}${filters ? `?${filters}` : ""}`}
                                  className="text-default-100"
                                >
                                  <Chip
                                    avatar={
                                      <Avatar
                                        showFallback
                                        src={q.avatar_url || undefined}
                                      />
                                    }
                                    variant="bordered"
                                    color="primary"
                                    size="sm"
                                  >
                                    {q.f3_name}
                                  </Chip>
                                </Link>
                              ))
                            )}
                            {coq_list.length > 0
                              ? coq_list.map((q, i) => (
                                  <Link
                                    key={`q-${event.event_instance_id}-${i}`}
                                    href={`/stats/pax/${q.user_id}${filters ? `?${filters}` : ""}`}
                                    className="text-default-100"
                                  >
                                    <Chip
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
                                ))
                              : null}
                          </div>
                        </div>
                        <div className="flex justify-between pb-2">
                          <div className="flex flex-wrap gap-1 w-full">
                            {pax_list.length === 0 ? (
                              <span className="italic text-default-500">
                                No attendees
                              </span>
                            ) : (
                              <>
                                {/* Mobile: collapsed count, tap to expand */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePax(event.event_instance_id)
                                  }
                                  className={`${
                                    expandedPax.has(event.event_instance_id)
                                      ? "hidden"
                                      : "inline-flex"
                                  } sm:hidden items-center gap-1 text-sm text-default-500`}
                                >
                                  {pax_list.length} PAX
                                  <span className="text-xs">▾</span>
                                </button>
                                {/* Chips: always on desktop; on mobile only when expanded */}
                                <div
                                  className={`${
                                    expandedPax.has(event.event_instance_id)
                                      ? "flex"
                                      : "hidden"
                                  } sm:flex flex-wrap gap-1 w-full`}
                                >
                                  {pax_list.map((pax, i) => (
                                    <Link
                                      key={`pax-${event.event_instance_id}-${i}`}
                                      href={`/stats/pax/${pax.user_id}${filters ? `?${filters}` : ""}`}
                                      className="text-default-100"
                                    >
                                      <Chip
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
                                        {pax.f3_name ?? pax.user_id.toString()}
                                      </Chip>
                                    </Link>
                                  ))}
                                  {/* Mobile: collapse back */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      togglePax(event.event_instance_id)
                                    }
                                    className="sm:hidden inline-flex items-center px-1 text-xs text-default-500"
                                  >
                                    Show less ▴
                                  </button>
                                </div>
                              </>
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
          {!isLoadingAll && eventsData.length > 0 && (
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

      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
            setEventDetails(null);
            setIsLoadingDetails(false);
          }
          onOpenChange();
        }}
        backdrop="blur"
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {selectedEvent ? (
              <div className="flex flex-col gap-3 w-full pr-10 sm:flex-row sm:items-start sm:justify-between">
                <EventDetailsHeader event={selectedEvent} filters={filters} />
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    as={NextLink}
                    href={`/stats/events/${selectedEvent.event_instance_id}`}
                    size="sm"
                    variant="bordered"
                    color="primary"
                  >
                    Event Page
                  </Button>
                  <CopyLinkButton
                    path={`/stats/events/${selectedEvent.event_instance_id}`}
                  />
                </div>
              </div>
            ) : (
              "Event Details"
            )}
          </ModalHeader>
          <ModalBody>
            {selectedEvent && (
              <EventDetailsBody
                event={selectedEvent}
                details={eventDetails}
                isLoadingDetails={isLoadingDetails}
                filters={filters}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
