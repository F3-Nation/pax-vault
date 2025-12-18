"use client";

import { RegionData, RegionUpcomingEvents } from "@/types/region";
import { getSummary, getLeaderboards, getKotterList } from "@/utils/region";
import { Filter } from "./PageFilter";
import { SummaryCard } from "./SummaryCard";
import { LeadersCard } from "./LeadersCard";
import { EventsCard } from "./EventsCard";
import { KotterCard } from "./KotterCard";
import { UpcomingEventsCard } from "./UpcomingEventsCard";
import { useState, useMemo } from "react";

export function RegionalPageWrapper({
  region_data,
  upcoming_events,
}: {
  region_data: RegionData[];
  upcoming_events: RegionUpcomingEvents[];
}) {
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [selectedRange, setSelectedRange] = useState<string>("All History");
  const [eventTypeFilter, setEventTypeFilter] = useState<
    "all" | "1st F" | "2nd F" | "3rd F"
  >("all");
  const [aoFilter, setAOFilter] = useState<"all" | string>("all");
  const aos = useMemo(() => {
    const map = new Map<string, string>();

    region_data.forEach((event) => {
      if (event.ao_org_id && !map.has(String(event.ao_org_id))) {
        // If you have a region name field, replace `event.ao_org_id` with that instead.
        map.set(String(event.ao_org_id), String(event.ao_name));
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [region_data]);

  const filteredRegionData = useMemo(() => {
    let data = region_data;
    // Filter by event type (1st F, 2nd F, 3rd F) when not "all"
    if (eventTypeFilter !== "all" && eventTypeFilter == "1st F") {
      data = data.filter((d) => d.first_f_ind == "1");
    } else if (eventTypeFilter !== "all" && eventTypeFilter == "2nd F") {
      data = data.filter((d) => d.second_f_ind == "1");
    } else if (eventTypeFilter !== "all" && eventTypeFilter == "3rd F") {
      data = data.filter((d) => d.third_f_ind == "1");
    }

    // Filter by AO
    if (aoFilter !== "all") {
      data = data.filter((d) => String(d.ao_org_id) === aoFilter);
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
  }, [region_data, eventTypeFilter, aoFilter, startDate, endDate]);

  const filteredEvents = useMemo(() => {
    let data = upcoming_events;
    // Filter by event type (1st F, 2nd F, 3rd F) when not "all"
    if (eventTypeFilter !== "all" && eventTypeFilter == "1st F") {
      data = data.filter((d) => d.event_category == "first_f");
    } else if (eventTypeFilter !== "all" && eventTypeFilter == "2nd F") {
      data = data.filter((d) => d.event_category == "second_f");
    } else if (eventTypeFilter !== "all" && eventTypeFilter == "3rd F") {
      data = data.filter((d) => d.event_category == "third_f");
    }

    // Filter by AO
    if (aoFilter !== "all") {
      data = data.filter((d) => String(d.ao_org_id) === aoFilter);
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
  }, [upcoming_events, eventTypeFilter, aoFilter, startDate, endDate]);

  const region_summary = getSummary(filteredRegionData);
  const region_leaders = getLeaderboards(filteredRegionData);
  const region_events = filteredRegionData;
  const region_kotters = getKotterList(filteredRegionData);
  const region_upcoming = filteredEvents.slice(0, 100); // Limit to 100 upcoming events
  return (
    <>
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pb-6 px-4">
        <div className="flex flex-col gap-3 w-full">
          <div className="flex gap-2 w-full">
            <Filter
              selectedRange={selectedRange}
              eventTypeFilter={eventTypeFilter}
              aoFilter={aoFilter}
              aos={aos}
              onRangeChange={(range, start, end) => {
                setSelectedRange(range);
                setStartDate(start);
                setEndDate(end);
              }}
              onEventTypeChange={(type) => setEventTypeFilter(type)}
              onAOChange={(aoId) => setAOFilter(aoId)}
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

      {!endDate || new Date(endDate) >= new Date() ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6">
          <KotterCard kotters={region_kotters || []} />
          <UpcomingEventsCard events={region_upcoming || []} />
        </div>
      ) : null}
      {/* <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 w-full max-w-6xl px-4 pt-6"></div> */}
      <div className="grid grid-cols-1 gap-6 w-full max-w-6xl pt-6 px-4">
        <EventsCard events={region_events} />
      </div>
    </>
  );
}
