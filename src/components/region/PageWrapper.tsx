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
  RegionInfo,
  ChartData,
  RegionAchievementPax,
  RegionAOBreakdown,
} from "@/lib/types";
import type { RegionPreferences } from "@/lib/preferences";
import { SummaryCard } from "./SummaryCard";
import { LeadersCard } from "../leaders";
import { KotterCard } from "./KotterCard";
import { UpcomingEventsCard } from "../upcomingEvents";
import { EventsCard } from "../events";
import { Filter } from "../pageFilter";
import { useMemo } from "react";
import { ChartCard } from "./ChartsCard";
import { AchievementsCard } from "./AchievementsCard";
import { AOBreakdownCard } from "./AOBreakdownCard";

type RegionalPageWrapperProps = {
  region_id: number;
  region_info: RegionInfo;
  region_summary: RegionSummary | null;
  region_kotter: RegionKotterList[] | null;
  region_leaders: Leaders[] | null;
  region_upcoming: EventUpcoming[] | null;
  region_events: EventData[];
  region_charts: ChartData[];
  region_achievements: RegionAchievementPax[];
  region_ao_breakdown: RegionAOBreakdown[];
  /** This region's saved preferences; drives opt-in display toggles. */
  region_preferences: RegionPreferences;
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
    persist?: string;
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

  if (searchParams.persist) qp.append("persist", searchParams.persist);

  return qp.toString();
}

export function RegionalPageWrapper({
  region_id,
  region_info,
  region_summary,
  region_kotter,
  region_leaders,
  region_upcoming,
  region_events,
  region_charts,
  region_achievements,
  region_ao_breakdown,
  region_preferences,
  searchParams,
}: RegionalPageWrapperProps) {
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
          aos={region_info.aos || []}
          types={region_info.types || []}
          tags={region_info.tags || []}
          filters={eventsFiltersQuery}
        />
      )}
      {/* Summary + leaders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl">
        <SummaryCard
          summary={region_summary!}
          filters={eventsFiltersQuery}
          showFartsackGhost={region_preferences.showFartsackGhostStats}
        />
        <LeadersCard
          leaders={
            region_leaders
              ? Array.isArray(region_leaders)
                ? region_leaders
                : [region_leaders]
              : []
          }
          height={330}
          page="region"
          filters={eventsFiltersQuery}
        />
      </div>
      {/* Charting */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl hidden">
        <ChartCard charts={region_charts || []} />
      </div>
      {/* Drill-down: who to celebrate (Achievements) and who's drifting (Kotter).
          Balanced 2-col peers so neither stretches to leave dead space. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start w-full max-w-6xl">
        <AchievementsCard
          achievements={region_achievements || []}
          filters={eventsFiltersQuery}
        />
        <KotterCard
          kotters={region_kotter || []}
          filters={eventsFiltersQuery}
        />
      </div>
      {/* Upcoming events beside the AO breakdown. Balanced 2-col peers with
          top alignment so the shorter card doesn't stretch. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start w-full max-w-6xl">
        <UpcomingEventsCard
          events={region_upcoming || []}
          filters={eventsFiltersQuery}
        />
        <AOBreakdownCard
          aos={region_ao_breakdown || []}
          filters={eventsFiltersQuery}
        />
      </div>
      {/* Event list */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl">
        <EventsCard
          events={region_events}
          thisRegionId={region_id}
          filtersQuery={eventsFiltersQuery}
          filters={eventsFiltersQuery}
          showFartsackGhost={region_preferences.showFartsackGhostStats}
        />
      </div>
      {/* Page-level filters at bottom of page if no filters are active */}
      {eventsFiltersQuery.length === 0 && (
        <Filter
          aos={region_info.aos || []}
          types={region_info.types || []}
          tags={region_info.tags || []}
          filters={eventsFiltersQuery}
        />
      )}
    </>
  );
}
