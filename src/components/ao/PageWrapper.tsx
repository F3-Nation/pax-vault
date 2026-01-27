"use client";

/**
 * AOPageWrapper
 *
 * Composes all AO-level dashboard sections (summary, leaders, kotters,
 * upcoming events, event list, and filters) into a single page layout.
 *
 * This component is intentionally "dumb": it receives fully-prepared data
 * and focuses only on rendering and query-string passthrough.
 */

import {
  AOSummary,
  Leaders,
  EventData,
  EventUpcoming,
  AOInfo,
} from "@/lib/types";
import { SummaryCard } from "./SummaryCard";
import { LeadersCard } from "../leaders";
import { UpcomingEventsCard } from "../upcomingEvents";
import { EventsCard } from "../events";
import { Filter } from "../pageFilter";
import { useMemo } from "react";

type AOPageWrapperProps = {
  ao_id: number;
  ao_info: AOInfo | null;
  ao_summary: AOSummary | null;
  ao_leaders: Leaders[] | null;
  ao_upcoming: EventUpcoming[] | null;
  ao_events: EventData[];
  searchParams: {
    categoryIds?: string | string[];
    categoryMode?: string;
    range?: string;
    startDate?: string;
    endDate?: string;
    typeIds?: string | string[];
    typeMode?: string;
    tagIds?: string | string[];
    tagMode?: string;
  };
};

/**
 * Build the query-string used by the EventsCard and Filter components
 * from raw search params.
 */
function buildEventsFiltersQuery(
  searchParams: AOPageWrapperProps["searchParams"],
): string {
  const qp = new URLSearchParams();

  if (searchParams.range) qp.append("range", searchParams.range);
  if (searchParams.startDate) qp.append("startDate", searchParams.startDate);
  if (searchParams.endDate) qp.append("endDate", searchParams.endDate);

  const appendList = (key: string, value?: string | string[]) => {
    if (!value) return;
    const list = Array.isArray(value) ? value : [value];
    const cleaned = list.filter(Boolean);
    if (cleaned.length) qp.append(key, cleaned.join(","));
  };

  appendList("tagIds", searchParams.tagIds);
  if (searchParams.tagMode) qp.append("tagMode", searchParams.tagMode);

  appendList("typeIds", searchParams.typeIds);
  if (searchParams.typeMode) qp.append("typeMode", searchParams.typeMode);

  appendList("categoryIds", searchParams.categoryIds);
  if (searchParams.categoryMode)
    qp.append("categoryMode", searchParams.categoryMode);

  return qp.toString();
}

export function AOPageWrapper({
  ao_id,
  ao_info,
  ao_summary,
  ao_leaders,
  ao_upcoming,
  ao_events,
  searchParams,
}: AOPageWrapperProps) {
  // Memoized query-string passed to events + filter components.
  const eventsFiltersQuery = useMemo(
    () => buildEventsFiltersQuery(searchParams),
    [searchParams],
  );

  return (
    <>
      {/* Page-level filters at top of page if filters are active */}
      {eventsFiltersQuery.length > 0 && (
        <Filter
          types={ao_info?.types || []}
          tags={ao_info?.tags || []}
          filters={eventsFiltersQuery}
        />
      )}
      {/* Summary + leaders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
        <SummaryCard summary={ao_summary!} />
        <LeadersCard
          leaders={
            ao_leaders
              ? Array.isArray(ao_leaders)
                ? ao_leaders
                : [ao_leaders]
              : []
          }
          title="AO"
          height={260}
        />
      </div>
      {/* Kotters + upcoming events */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
        <UpcomingEventsCard events={ao_upcoming || []} />
      </div>
      {/* Event list */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
        <EventsCard
          events={ao_events}
          thisAOId={ao_id}
          filtersQuery={eventsFiltersQuery}
        />
      </div>
      {/* Page-level filters at top of page if no filters are active */}
      {eventsFiltersQuery.length === 0 && (
        <Filter
          types={ao_info?.types || []}
          tags={ao_info?.tags || []}
          filters={eventsFiltersQuery}
        />
      )}
    </>
  );
}
