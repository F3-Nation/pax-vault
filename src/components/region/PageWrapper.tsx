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
    categoryID: string | string[] | undefined;
    aoID: string | string[] | undefined;
    range: string | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    typeID: string | string[] | undefined;
    tagID: string | string[] | undefined;
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
    searchParams.categoryID
      ? Array.isArray(searchParams.categoryID)
        ? searchParams.categoryID
        : [searchParams.categoryID]
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
    searchParams.typeID
      ? Array.isArray(searchParams.typeID)
        ? searchParams.typeID
        : [searchParams.typeID]
      : [],
  );

  const [tagsFilter, setTagsFilter] = useState<string[]>(
    searchParams.tagID
      ? Array.isArray(searchParams.tagID)
        ? searchParams.tagID
        : [searchParams.tagID]
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
    const typeMap = new Map<
      string,
      { id: string; name: string; description: string; event_category: string }
    >();

    region_data.forEach((event) => {
      event.types?.forEach((type) => {
        const id = type.id.toString();
        if (!typeMap.has(id)) {
          typeMap.set(id, {
            id,
            name: type.name,
            description: type.description,
            event_category: type.event_category,
          });
        }
      });
    });

    return Array.from(typeMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [region_data]);

  const tags = useMemo(() => {
    const tagMap = new Map<
      string,
      { id: string; name: string; description: string }
    >();

    region_data.forEach((event) => {
      event.tags?.forEach((tag) => {
        const id = tag.id.toString();
        if (!tagMap.has(id)) {
          tagMap.set(id, {
            id,
            name: tag.name,
            description: tag.description,
          });
        }
      });
    });

    return Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [region_data]);

  const filteredRegionData = useMemo(() => {
    let data = region_data; // Filter by one or more event types (OR logic)

    // Category filter
    if (categoryFilter.length > 0) {
      data = data.filter((d) => {
        return (
          (categoryFilter.includes("1") && d.first_f_ind == "1") ||
          (categoryFilter.includes("2") && d.second_f_ind == "1") ||
          (categoryFilter.includes("3") && d.third_f_ind == "1")
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
        if (!d.types || d.types.length === 0) return false;
        return typesFilter.some((type) =>
          d.types!.some((t) => t.id.toString() === type),
        );
      });
    }

    // Tag filters
    if (tagsFilter.length > 0) {
      data = data.filter((d) => {
        if (!d.tags || d.tags.length === 0) return false;
        return tagsFilter.some((tag) =>
          d.tags!.some((t) => t.id.toString() === tag),
        );
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
          (categoryFilter.includes("1") && d.event_category == "first_f") ||
          (categoryFilter.includes("2") && d.event_category == "second_f") ||
          (categoryFilter.includes("3") && d.event_category == "third_f")
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
              onCategoryChange={(categoryId) =>
                setCategoryFilter(categoryId === "all" ? [] : categoryId)
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
