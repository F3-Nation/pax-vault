"use client";

import { RegionData, RegionUpcomingEvents } from "@/types/region";
import {
  getSummary,
  getLeaderboards,
  getKotterList,
  getChartData,
} from "@/utils/region";
import { Filter } from "../pageFilter";
import { SummaryCard } from "./SummaryCard";
import { LeadersCard } from "./LeadersCard";
import { EventsCard } from "./EventsCard";
import { KotterCard } from "./KotterCard";
import { ChartsCard } from "./ChartsCard";
import { UpcomingEventsCard } from "./UpcomingEventsCard";
import { useState, useMemo } from "react";

export function RegionalPageWrapper({
  region_data,
  upcoming_events,
  searchParams,
}: {
  region_data: RegionData[];
  upcoming_events: RegionUpcomingEvents[];
  searchParams: {
    categories: string | string[] | undefined;
    aoID: string | string[] | undefined;
    range: string | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    types: string | string[] | undefined;
    tags: string | string[] | undefined;
  };
}) {
  const [startDate, setStartDate] = useState<string | undefined>(
    searchParams.startDate,
  );
  const [endDate, setEndDate] = useState<string | undefined>(
    searchParams.endDate,
  );

  const [selectedRange, setSelectedRange] = useState<string>(
    searchParams.range ?? "All History",
  );

  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    searchParams.categories
      ? Array.isArray(searchParams.categories)
        ? searchParams.categories
        : [searchParams.categories]
      : [],
  );

  const [aoFilter, setAOFilter] = useState<string[]>(
    searchParams.aoID
      ? Array.isArray(searchParams.aoID)
        ? searchParams.aoID
        : [searchParams.aoID]
      : [],
  );

  const [typesFilter, setTypesFilter] = useState<string[]>(
    searchParams.types
      ? Array.isArray(searchParams.types)
        ? searchParams.types
        : [searchParams.types]
      : [],
  );

  const [tagsFilter, setTagsFilter] = useState<string[]>(
    searchParams.tags
      ? Array.isArray(searchParams.tags)
        ? searchParams.tags
        : [searchParams.tags]
      : [],
  );

  const aos = useMemo(() => {
    const map = new Map<string, string>();
    let hasUnassigned = false;

    region_data.forEach((event) => {
      if (event.ao_org_id == null) {
        hasUnassigned = true;
        return;
      }

      const key = String(event.ao_org_id);
      if (!map.has(key)) {
        map.set(key, String(event.ao_name));
      }
    });

    const results = Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));

    if (hasUnassigned) {
      results.push({
        id: "unassigned",
        name: "Unassigned AO",
      });
    }

    return results;
  }, [region_data]);

  const types = useMemo(() => {
    const typeSet = new Set<string>();
    region_data.forEach((event) => {
      event.all_types?.forEach((type) => typeSet.add(type));
    });
    return Array.from(typeSet).sort();
  }, [region_data]);

  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    region_data.forEach((event) => {
      event.all_tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [region_data]);

  const filteredRegionData = useMemo(() => {
    let data = region_data; // Filter by one or more event types (OR logic)

    // Category filter
    if (categoryFilter.length > 0) {
      data = data.filter((d) => {
        return (
          (categoryFilter.includes("1st F") && d.first_f_ind == "1") ||
          (categoryFilter.includes("2nd F") && d.second_f_ind == "1") ||
          (categoryFilter.includes("3rd F") && d.third_f_ind == "1")
        );
      });
    }

    // Filter by AO
    if (aoFilter.length > 0) {
      if (aoFilter.includes("unassigned")) {
        data = data.filter((d) => d.ao_org_id == null);
      } else {
        data = data.filter((d) => aoFilter.includes(String(d.ao_org_id)));
      }
    }

    // Date range filters
    if (startDate) {
      const start = new Date(startDate);
      data = data.filter((d) => new Date(d.event_date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      data = data.filter((d) => new Date(d.event_date) <= end);
    }

    // Type filters
    if (typesFilter.length > 0) {
      data = data.filter((d) => {
        if (!d.all_types || d.all_types.length === 0) return false;
        return typesFilter.some((type) => d.all_types!.includes(type));
      });
    }

    // Tag filters
    if (tagsFilter.length > 0) {
      data = data.filter((d) => {
        if (!d.all_tags || d.all_tags.length === 0) return false;
        return tagsFilter.some((tag) => d.all_tags!.includes(tag));
      });
    }

    return data;
  }, [
    region_data,
    categoryFilter,
    aoFilter,
    startDate,
    endDate,
    typesFilter,
    tagsFilter,
  ]);

  const filteredEvents = useMemo(() => {
    let data = upcoming_events;
    // Filter by one or more event types (OR logic)
    if (categoryFilter.length > 0) {
      data = data.filter((d) => {
        return (
          (categoryFilter.includes("1st F") && d.event_category == "first_f") ||
          (categoryFilter.includes("2nd F") &&
            d.event_category == "second_f") ||
          (categoryFilter.includes("3rd F") && d.event_category == "third_f")
        );
      });
    }

    // Filter by AO
    if (aoFilter.length > 0) {
      if (aoFilter.includes("unassigned")) {
        data = data.filter((d) => d.ao_org_id == null);
      } else {
        data = data.filter((d) => aoFilter.includes(String(d.ao_org_id)));
      }
    }

    // Date range filters
    if (startDate) {
      const start = new Date(startDate);
      data = data.filter((d) => new Date(d.start_date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      data = data.filter((d) => new Date(d.start_date) <= end);
    }

    return data;
  }, [upcoming_events, categoryFilter, aoFilter, startDate, endDate]);

  const region_summary = getSummary(filteredRegionData);
  const region_leaders = getLeaderboards(filteredRegionData);
  const region_events = filteredRegionData;
  const region_kotters = getKotterList(filteredRegionData);
  const region_upcoming = filteredEvents.slice(0, 100); // Limit to 100 upcoming events
  const region_charts = getChartData(filteredRegionData, startDate, endDate);
  return (
    <>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl px-4">
        <div className="flex flex-col gap-3 w-full">
          <div className="flex gap-2 w-full">
            <Filter
              selectedRange={selectedRange}
              startDate={startDate}
              endDate={endDate}
              categoryFilter={categoryFilter}
              aoFilter={aoFilter}
              aos={aos}
              typesFilter={typesFilter}
              types={types}
              tagsFilter={tagsFilter}
              tags={tags}
              onRangeChange={(range, start, end) => {
                setSelectedRange(range);
                setStartDate(start);
                setEndDate(end);
              }}
              onCategoryChange={(categories) =>
                setCategoryFilter(categories === "all" ? [] : categories)
              }
              onAOChange={(aoId) => setAOFilter(aoId === "all" ? [] : aoId)}
              onTypeChange={(type) =>
                setTypesFilter(type === "all" ? [] : type)
              }
              onTagChange={(tag) => setTagsFilter(tag === "all" ? [] : tag)}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        <SummaryCard summary={region_summary!} />
        <LeadersCard
          leaders={
            region_leaders
              ? Array.isArray(region_leaders)
                ? region_leaders
                : [region_leaders]
              : []
          }
        />
      </div>
      {/* <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4"></div> */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4 text-xs">
        <ChartsCard chartData={region_charts} />
      </div>
      {!endDate || new Date(endDate) >= new Date() ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6">
          <KotterCard kotters={region_kotters || []} />
          <UpcomingEventsCard events={region_upcoming || []} />
        </div>
      ) : null}
      {/* <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6"></div> */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl py-6 px-4">
        <EventsCard events={region_events} />
      </div>
    </>
  );
}
