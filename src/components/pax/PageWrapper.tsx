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
    categoryID: string | string[] | undefined;
    categoryMode: string | undefined;
    regionID: string | string[] | undefined;
    regionMode: string | undefined;
    range: string | undefined;
    startDate: string | undefined;
    endDate: string | undefined;
    typeID: string | string[] | undefined;
    typeMode: string | undefined;
    tagID: string | string[] | undefined;
    tagMode: string | undefined;
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

  const [categoryMode, setCategoryMode] = useState<"include" | "exclude">(
    (searchParams.categoryMode as "exclude") ?? "include",
  );

  const [regionFilter, setRegionFilter] = useState<string[]>(
    searchParams.regionID
      ? Array.isArray(searchParams.regionID)
        ? searchParams.regionID
        : [searchParams.regionID]
      : [],
  );

  const [regionMode, setRegionMode] = useState<"include" | "exclude">(
    (searchParams.regionMode as "exclude") ?? "include",
  );

  const [typesFilter, setTypesFilter] = useState<string[]>(
    searchParams.typeID
      ? Array.isArray(searchParams.typeID)
        ? searchParams.typeID
        : [searchParams.typeID]
      : [],
  );

  const [typeMode, setTypeMode] = useState<"include" | "exclude">(
    (searchParams.typeMode as "exclude") ?? "include",
  );

  const [tagsFilter, setTagsFilter] = useState<string[]>(
    searchParams.tagID
      ? Array.isArray(searchParams.tagID)
        ? searchParams.tagID
        : [searchParams.tagID]
      : [],
  );

  const [tagMode, setTagMode] = useState<"include" | "exclude">(
    (searchParams.tagMode as "exclude") ?? "include",
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
    const typeMap = new Map<
      string,
      { id: string; name: string; description: string; event_category: string }
    >();
    pax_data.events.forEach((event) => {
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
  }, [pax_data.events]);

  const tags = useMemo(() => {
    const tagMap = new Map<
      string,
      { id: string; name: string; description: string }
    >();

    pax_data.events.forEach((event) => {
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
  }, [pax_data.events]);

  const filteredPaxData = useMemo(() => {
    let data = pax_data.events; // Filter by one or more event types (OR logic)

    // Category filter
    if (categoryFilter.length > 0) {
      data = data.filter((d) => {
        if (categoryMode === "exclude") {
          return !(
            (categoryFilter.includes("1") && d.first_f_ind == "1") ||
            (categoryFilter.includes("2") && d.second_f_ind == "1") ||
            (categoryFilter.includes("3") && d.third_f_ind == "1")
          );
        }
        return (
          (categoryFilter.includes("1") && d.first_f_ind == "1") ||
          (categoryFilter.includes("2") && d.second_f_ind == "1") ||
          (categoryFilter.includes("3") && d.third_f_ind == "1")
        );
      });
    }

    // Filter by Region
    if (regionFilter.length > 0) {
      if (regionMode === "exclude") {
        if (regionFilter.includes("unassigned")) {
          data = data.filter((d) => d.region_org_id != null);
        } else {
          data = data.filter(
            (d) => !regionFilter.includes(String(d.region_org_id)),
          );
        }
      } else {
        if (regionFilter.includes("unassigned")) {
          data = data.filter((d) => d.region_org_id == null);
        } else {
          data = data.filter((d) =>
            regionFilter.includes(String(d.region_org_id)),
          );
        }
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
        if (typeMode === "exclude") {
          return !typesFilter.some((type) =>
            d.types!.some((t) => t.id.toString() === type),
          );
        } else {
          return typesFilter.some((type) =>
            d.types!.some((t) => t.id.toString() === type),
          );
        }
      });
    }

    // Tag filters
    if (tagsFilter.length > 0) {
      data = data.filter((d) => {
        if (!d.tags || d.tags.length === 0) return false;
        if (tagMode === "exclude") {
          return !tagsFilter.some((tag) =>
            d.tags!.some((t) => t.id.toString() === tag),
          );
        } else {
          return tagsFilter.some((tag) =>
            d.tags!.some((t) => t.id.toString() === tag),
          );
        }
      });
    }

    return data;
  }, [
    pax_data.events,
    categoryFilter,
    categoryMode,
    regionFilter,
    regionMode,
    startDate,
    endDate,
    typesFilter,
    typeMode,
    tagsFilter,
    tagMode,
  ]);

  const pax_summary = getSummary(
    { ...pax_data, events: filteredPaxData },
    startDate,
    endDate,
  );
  const pax_ao_breakdown = getAOBreakdown({
    ...pax_data,
    events: filteredPaxData,
  });
  const pax_charting = getPaxCharting({ ...pax_data, events: filteredPaxData });

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
              categoryMode={categoryMode}
              regionFilter={regionFilter}
              regionMode={regionMode}
              regions={regions}
              typesFilter={typesFilter}
              typeMode={typeMode}
              types={types}
              tagsFilter={tagsFilter}
              tagMode={tagMode}
              tags={tags}
              onRangeChange={(range, start, end) => {
                setSelectedRange(range);
                setStartDate(start);
                setEndDate(end);
              }}
              onCategoryChange={(categoryId) =>
                setCategoryFilter(categoryId === "all" ? [] : categoryId)
              }
              onCategoryModeChange={(categoryMode) =>
                setCategoryMode(categoryMode)
              }
              onRegionChange={(regionId) =>
                setRegionFilter(regionId === "all" ? [] : regionId)
              }
              onRegionModeChange={(regionMode) => setRegionMode(regionMode)}
              onTypeChange={(type) =>
                setTypesFilter(type === "all" ? [] : type)
              }
              onTypeModeChange={(typeMode) => setTypeMode(typeMode)}
              onTagChange={(tag) => setTagsFilter(tag === "all" ? [] : tag)}
              onTagModeChange={(tagMode) => setTagMode(tagMode)}
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
