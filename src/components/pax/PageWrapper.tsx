"use client";

/**
 * PAXPageWrapper
 *
 * Composes all pax-level dashboard sections (summary, AODashboard, kotters,
 * upcoming events, event list, and filters) into a single page layout.
 *
 * This component is intentionally "dumb": it receives fully-prepared data
 * and focuses only on rendering and query-string passthrough.
 */

import { PaxAOBreakdown, PaxSummary, EventData, PAXInfo } from "@/lib/types";
import { Filter } from "../pageFilter";
import { useMemo } from "react";
import { SummaryCard } from "./SummaryCard";
import { AOBreakdownCard } from "./AOBreakdownCard";
import { EventsCard } from "../events";

type PAXPageWrapperProps = {
  pax_id: number;
  pax_info: PAXInfo | null;
  pax_summary: PaxSummary | null;
  pax_ao_breakdown: PaxAOBreakdown[] | null;
  pax_events: EventData[];
  searchParams: {
    categoryIds?: string | string[];
    categoryMode?: string;
    aoIds?: string | string[];
    aoMode?: string;
    regionIds?: string | string[];
    regionMode?: string;
    range?: string;
    startDate?: string;
    endDate?: string;
    typeIds?: string | string[];
    typeMode?: string;
    tagIds?: string | string[];
    tagMode?: string;
    persist?: string;
  };
};

/**
 * Build the query-string used by the EventsCard and Filter components
 * from raw search params.
 */
function buildEventsFiltersQuery(
  searchParams: PAXPageWrapperProps["searchParams"],
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

  appendList("regionIds", searchParams.regionIds);
  if (searchParams.regionMode) qp.append("regionMode", searchParams.regionMode);

  appendList("tagIds", searchParams.tagIds);
  if (searchParams.tagMode) qp.append("tagMode", searchParams.tagMode);

  appendList("typeIds", searchParams.typeIds);
  if (searchParams.typeMode) qp.append("typeMode", searchParams.typeMode);

  appendList("categoryIds", searchParams.categoryIds);
  if (searchParams.categoryMode)
    qp.append("categoryMode", searchParams.categoryMode);

  if (searchParams.persist) qp.append("persist", searchParams.persist);

  return qp.toString();
}

export function PAXPageWrapper({
  pax_id,
  pax_info,
  pax_summary,
  pax_ao_breakdown,
  pax_events,
  searchParams,
}: PAXPageWrapperProps) {
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
          aos={pax_info?.aos || []}
          regions={pax_info?.regions || []}
          types={pax_info?.types || []}
          tags={pax_info?.tags || []}
          filters={eventsFiltersQuery}
        />
      )}
      {/* Summary + leaders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
        <SummaryCard summary={pax_summary!} filters={eventsFiltersQuery} />
        <AOBreakdownCard
          AOBreakdown={pax_ao_breakdown!}
          filters={eventsFiltersQuery}
        />
      </div>
      {/* Event list */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
        <EventsCard
          events={pax_events}
          thisPaxId={pax_id}
          filtersQuery={eventsFiltersQuery}
          filters={eventsFiltersQuery}
        />
      </div>
      {/* Page-level filters at top of page if no filters are active */}
      {eventsFiltersQuery.length === 0 && (
        <Filter
          aos={pax_info?.aos || []}
          regions={pax_info?.regions || []}
          types={pax_info?.types || []}
          tags={pax_info?.tags || []}
          filters={eventsFiltersQuery}
        />
      )}
    </>
  );
}
