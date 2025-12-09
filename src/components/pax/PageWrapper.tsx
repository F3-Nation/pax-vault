"use client";

import { PaxData } from "@/types/pax";
import { getSummary, getAOBreakdown, getPaxCharting } from "@/utils/pax";
import { Filter } from "./PageFilter";
import { useState, useMemo } from "react";
import { SummaryCard } from "./SummaryCard";
import { AOBreakdownCard } from "./AOBreakdownCard";
import { EventsCard } from "./EventsCard";
import { InsightsCard } from "./InsightsCard";

export function PaxPageWrapper({ pax_data }: { pax_data: PaxData }) {
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [selectedRange, setSelectedRange] = useState<string>("All History");
  const [eventTypeFilter, setEventTypeFilter] = useState<
    "all" | "1st F" | "2nd F" | "3rd F"
  >("all");
  const [regionFilter, setRegionFilter] = useState<"all" | string>("all");

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

  const filteredPaxData = useMemo(() => {
    let data = pax_data.events;
    // Filter by event type (1st F, 2nd F, 3rd F) when not "all"
    if (eventTypeFilter !== "all" && eventTypeFilter == "1st F") {
      data = data.filter((d) => d.first_f_ind === "1");
    } else if (eventTypeFilter !== "all" && eventTypeFilter == "2nd F") {
      data = data.filter((d) => d.second_f_ind === "1");
    } else if (eventTypeFilter !== "all" && eventTypeFilter == "3rd F") {
      data = data.filter((d) => d.third_f_ind === "1");
    }

    // Filter by region
    if (regionFilter !== "all") {
      data = data.filter((d) => String(d.region_org_id) === regionFilter);
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

    return data;
  }, [pax_data, eventTypeFilter, regionFilter, startDate, endDate]);

  const pax_summary = getSummary(
    { ...pax_data, events: filteredPaxData },
    startDate,
    endDate
  );
  const pax_ao_breakdown = getAOBreakdown({
    ...pax_data,
    events: filteredPaxData,
  });
  const pax_charting = getPaxCharting({ ...pax_data, events: filteredPaxData });

  return (
    <>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <div className="flex flex-col gap-3 w-full">
          <div className="flex gap-2 w-full">
            <Filter
              start_date={startDate || ""}
              end_date={endDate || ""}
              selectedRange={selectedRange}
              eventTypeFilter={eventTypeFilter}
              regionFilter={regionFilter}
              regions={regions}
              onRangeChange={(range, start, end) => {
                setSelectedRange(range);
                setStartDate(start);
                setEndDate(end);
              }}
              onEventTypeChange={(type) => setEventTypeFilter(type)}
              onRegionChange={(regionId) => setRegionFilter(regionId)}
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
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        {/* Recent Events Card */}
        <EventsCard events={filteredPaxData} thisUserId={this_user_id} />
      </div>
    </>
  );
}
