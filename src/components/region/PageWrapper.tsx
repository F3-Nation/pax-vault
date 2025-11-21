"use client";

import { RegionData } from "@/types/region";
import { getSummary, getLeaderboards } from "@/utils/region";
import { DateFilter } from "../dateFilter";
import { RegionSummaryCard } from "./RegionSummaryCard";
import { RegionLeadersCard } from "./RegionLeadersCard";
import { RegionEventsCard } from "./RegionEventsCard";
import { useState, useMemo } from "react";

export function RegionalPageWrapper({
  region_data
}: {
  region_data: RegionData[];
}) {
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [selectedRange, setSelectedRange] = useState<string>("Overall");
    
  const filteredRegionData = useMemo(() => {
    let data = region_data;
    if (startDate) {
      const start = new Date(startDate);
      data = data.filter((d) => new Date(d.event_date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      data = data.filter((d) => new Date(d.event_date) <= end);
    }
    return data;
  }, [region_data, startDate, endDate]);

  const region_summary = getSummary(filteredRegionData);
  const region_leaders = getLeaderboards(filteredRegionData);
  const region_events  = filteredRegionData;
  return (
    <>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <div className="flex gap-2 w-full">
          <DateFilter
            start_date={startDate || ""}
            end_date={endDate || ""}
            selectedRange={selectedRange}
            onRangeChange={(range, start, end) => {
                setSelectedRange(range);
                setStartDate(start);
                setEndDate(end);
            }}
            />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4">
        {/* Workout Summary Card */}
        <RegionSummaryCard summary={region_summary!} />
        {/* Leaderboard Card */}
        <RegionLeadersCard leaders={region_leaders ? (Array.isArray(region_leaders) ? region_leaders : [region_leaders]) : []} />
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Insights Card */}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6">
        {/* Alt Chart Card */}
        {/* Q Lineup Card */}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6">
        {/* Alt Chart Card */}
        {/* Q Lineup Card */}
      </div>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Recent Events Card */}
        <RegionEventsCard events={region_events} />
      </div>
    </>
  );
}