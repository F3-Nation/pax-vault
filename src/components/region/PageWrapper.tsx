"use client";

/**
 * RegionalPageWrapper
 *
 * Composes all region-level dashboard sections (summary, leaders, kotters,
 * upcoming events, event list, and filters) into a single page layout.
 *
 * This component is intentionally "dumb": it receives fully-prepared data
 * and focuses only on rendering and query-string passthrough.
 */

import {
  RegionSummary,
  Leaders,
  EventData,
  RegionKotterList,
  EventUpcoming,
  PageFilters,
} from "@/lib/types";
import { SummaryCard } from "./SummaryCard";
import { LeadersCard } from "../leaders";
import { KotterCard } from "./KotterCard";
import { UpcomingEventsCard } from "../upcomingEvents";
import { EventsCard } from "../events";
import { Filter } from "../pageFilter";
import { useMemo } from "react";

type RegionalPageWrapperProps = {
  region_id: number;
  region_summary: RegionSummary | null;
  region_kotter: RegionKotterList[] | null;
  region_leaders: Leaders[] | null;
  region_upcoming: EventUpcoming[] | null;
  region_events: EventData[];
  region_filters: PageFilters | null;
  searchParams: {
    categoryIds?: string | string[];
    categoryMode?: string;
    aoIds?: string | string[];
    aoMode?: string;
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
  searchParams: RegionalPageWrapperProps["searchParams"],
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

  appendList("aoIds", searchParams.aoIds);
  if (searchParams.aoMode) qp.append("aoMode", searchParams.aoMode);

  appendList("tagIds", searchParams.tagIds);
  if (searchParams.tagMode) qp.append("tagMode", searchParams.tagMode);

  appendList("typeIds", searchParams.typeIds);
  if (searchParams.typeMode) qp.append("typeMode", searchParams.typeMode);

  appendList("categoryIds", searchParams.categoryIds);
  if (searchParams.categoryMode)
    qp.append("categoryMode", searchParams.categoryMode);

  return qp.toString();
}

export function RegionalPageWrapper({
  region_id,
  region_summary,
  region_kotter,
  region_leaders,
  region_upcoming,
  region_events,
  region_filters,
  searchParams,
}: RegionalPageWrapperProps) {
  // Memoized query-string passed to events + filter components.
  const eventsFiltersQuery = useMemo(
    () => buildEventsFiltersQuery(searchParams),
    [searchParams],
  );

  return (
    <>
      {/* Summary + leaders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
        <SummaryCard summary={region_summary!} />
        <LeadersCard
          leaders={
            region_leaders
              ? Array.isArray(region_leaders)
                ? region_leaders
                : [region_leaders]
              : []
          }
          title="Region"
          height={260}
        />
      </div>
      {/* Kotters + upcoming events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
        <KotterCard kotters={region_kotter || []} />
        <UpcomingEventsCard events={region_upcoming || []} />
      </div>
      {/* Event list */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
        <EventsCard
          events={region_events}
          thisRegionId={region_id}
          filtersQuery={eventsFiltersQuery}
        />
      </div>
      {/* Page-level filters */}
      <Filter
        aos={region_filters?.aos || []}
        types={region_filters?.types || []}
        tags={region_filters?.tags || []}
        filters={eventsFiltersQuery}
      />
    </>
  );
}
