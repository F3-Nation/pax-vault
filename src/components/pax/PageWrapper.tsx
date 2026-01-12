"use client";

import { PaxData } from "@/types/pax";
import { getSummary, getAOBreakdown, getPaxCharting } from "@/utils/pax";
import { Filter } from "../pageFilter";
import { useState, useMemo } from "react";
import { SummaryCard } from "./SummaryCard";
import { AOBreakdownCard } from "./AOBreakdownCard";
import { EventsCard } from "./EventsCard";
import { InsightsCard } from "./InsightsCard";

export function PaxPageWrapper({
  pax_data,
  searchParams,
}: {
  pax_data: PaxData;
  searchParams: {
    categories: string | string[] | undefined;
    regionID: string | string[] | undefined;
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

  const [regionFilter, setRegionFilter] = useState<string[]>(
    searchParams.regionID
      ? Array.isArray(searchParams.regionID)
        ? searchParams.regionID
        : [searchParams.regionID]
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

  const this_user_id = pax_data.info?.user_id;

  const regions = useMemo(() => {
    const map = new Map<string, string>();

    pax_data.events.forEach((event) => {
      if (event.region_org_id && !map.has(String(event.region_org_id))) {
        // If you have a region name field, replace `event.region_org_id` with that instead.
        map.set(String(event.region_org_id), String(event.region_name));
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [pax_data.events]);

  const types = useMemo(() => {
    const typeSet = new Set<string>();
    pax_data.events.forEach((event) => {
      event.all_types?.forEach((type) => typeSet.add(type));
    });
    return Array.from(typeSet).sort();
  }, [pax_data.events]);

  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    pax_data.events.forEach((event) => {
      event.all_tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [pax_data.events]);

  const filteredPaxData = useMemo(() => {
    let data = pax_data.events; // Filter by one or more event types (OR logic)

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

    // Filter by Region
    if (regionFilter.length > 0) {
      if (regionFilter.includes("unassigned")) {
        data = data.filter((d) => d.region_org_id == null);
      } else {
        data = data.filter((d) =>
          regionFilter.includes(String(d.region_org_id)),
        );
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
    pax_data.events,
    categoryFilter,
    regionFilter,
    startDate,
    endDate,
    typesFilter,
    tagsFilter,
  ]);

  // Memoize expensive computations to avoid recalculating on every render
  const pax_summary = useMemo(() => {
    return getSummary(
      { ...pax_data, events: filteredPaxData },
      startDate,
      endDate,
    );
  }, [pax_data, filteredPaxData, startDate, endDate]);

  const pax_ao_breakdown = useMemo(() => {
    return getAOBreakdown({
      ...pax_data,
      events: filteredPaxData,
    });
  }, [pax_data, filteredPaxData]);

  const pax_charting = useMemo(() => {
    return getPaxCharting({ ...pax_data, events: filteredPaxData });
  }, [pax_data, filteredPaxData]);

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
              regionFilter={regionFilter}
              regions={regions}
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
              onRegionChange={(regionId) =>
                setRegionFilter(regionId === "all" ? [] : regionId)
              }
              onTypeChange={(type) =>
                setTypesFilter(type === "all" ? [] : type)
              }
              onTagChange={(tag) => setTagsFilter(tag === "all" ? [] : tag)}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        {/* Workout Summary Card */}
        <SummaryCard summary={pax_summary!} />
        {/* AO Breakdown Card */}
        <AOBreakdownCard AOBreakdown={pax_ao_breakdown} />
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Insights Card */}
        <InsightsCard
          paxInsights={
            Array.isArray(pax_charting) ? pax_charting : [pax_charting]
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl py-6 px-4">
        {/* Recent Events Card */}
        <EventsCard events={filteredPaxData} thisUserId={this_user_id} />
      </div>
    </>
  );
}
