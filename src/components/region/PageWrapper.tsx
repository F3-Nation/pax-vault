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
} from "@/lib/types";
import { SummaryCard } from "./SummaryCard";
import { LeadersCard } from "../leaders";
import { KotterCard } from "./KotterCard";
import { UpcomingEventsCard } from "../upcomingEvents";
import { EventsCard } from "../events";
import { Filter } from "../pageFilter";
import { useMemo } from "react";
import { Chip } from "@heroui/chip";

type RegionalPageWrapperProps = {
  region_id: number;
  region_info: RegionInfo;
  region_summary: RegionSummary | null;
  region_kotter: RegionKotterList[] | null;
  region_leaders: Leaders[] | null;
  region_upcoming: EventUpcoming[] | null;
  region_events: EventData[];
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

type ChipVariant = "primary" | "secondary" | "warning" | "default" | "success";

function toList(v?: string | string[]): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v])
    .flatMap((s) => (s ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

function lookupName(list: any[] | undefined, id: string): string {
  if (!Array.isArray(list)) return id;
  const found = list.find(
    (x) => String((x as any).id) === id || String((x as any).org_id) === id,
  );
  return (
    (found &&
      ((found as any).name ||
        (found as any).ao_name ||
        (found as any).label)) ||
    id
  );
}

export function RegionalPageWrapper({
  region_id,
  region_info,
  region_summary,
  region_kotter,
  region_leaders,
  region_upcoming,
  region_events,
  searchParams,
}: RegionalPageWrapperProps) {
  // Memoized query-string passed to events + filter components.
  const eventsFiltersQuery = useMemo(
    () => buildEventsFiltersQuery(searchParams),
    [searchParams],
  );

  const activeChips = useMemo(() => {
    const chips: { label: string; variant: ChipVariant }[] = [];

    // Dates (primary)
    if (searchParams.range) {
      chips.push({ label: `Range: ${searchParams.range}`, variant: "primary" });
    }
    if (searchParams.startDate) {
      chips.push({
        label: `Start: ${searchParams.startDate}`,
        variant: "primary",
      });
    }
    if (searchParams.endDate) {
      chips.push({ label: `End: ${searchParams.endDate}`, variant: "primary" });
    }

    // AOs (secondary)
    for (const id of toList(searchParams.aoIds)) {
      const name = lookupName((region_info as any).aos, id);
      chips.push({ label: `AO: ${name}`, variant: "secondary" });
    }
    if (searchParams.aoMode) {
      chips.push({
        label: `AO Mode: ${searchParams.aoMode}`,
        variant: "secondary",
      });
    }

    // Tags (warning)
    for (const id of toList(searchParams.tagIds)) {
      const name = lookupName((region_info as any).tags, id);
      chips.push({ label: `Tag: ${name}`, variant: "warning" });
    }
    if (searchParams.tagMode) {
      chips.push({
        label: `Tag Mode: ${searchParams.tagMode}`,
        variant: "warning",
      });
    }

    // Types (default)
    for (const id of toList(searchParams.typeIds)) {
      const name = lookupName((region_info as any).types, id);
      chips.push({ label: `Type: ${name}`, variant: "default" });
    }
    if (searchParams.typeMode) {
      chips.push({
        label: `Type Mode: ${searchParams.typeMode}`,
        variant: "default",
      });
    }

    // Categories (success)
    // RegionInfo may or may not include categories; fall back to raw IDs.
    const categories = (region_info as any).categories as any[] | undefined;
    for (const id of toList(searchParams.categoryIds)) {
      const name = lookupName(categories, id);
      chips.push({ label: `Category: ${name}`, variant: "success" });
    }
    if (searchParams.categoryMode) {
      chips.push({
        label: `Category Mode: ${searchParams.categoryMode}`,
        variant: "success",
      });
    }

    return chips;
  }, [searchParams, region_info]);

  return (
    <>
      {/* Active filters chips */}
      {activeChips.length > 0 && (
        <div className="w-full max-w-6xl">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-md border bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground shrink-0">
              Filters:
            </span>
            {activeChips.map((c, idx) => (
              <Chip
                key={`${c.label}-${idx}`}
                size="sm"
                color={c.variant}
                variant="flat"
                className="shrink-0"
                title={c.label}
              >
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
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
        aos={region_info.aos || []}
        types={region_info.types || []}
        tags={region_info.tags || []}
        filters={eventsFiltersQuery}
      />
    </>
  );
}
