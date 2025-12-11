"use client";

import { Button } from "@heroui/button";
import { Dropdown } from "@heroui/dropdown";
import { DropdownTrigger } from "@heroui/dropdown";
import { DropdownMenu } from "@heroui/dropdown";
import { DropdownItem } from "@heroui/dropdown";

function toUTCDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

export function Filter({
  start_date,
  end_date,
  selectedRange,
  eventTypeFilter,
  regionFilter,
  regions,
  onRangeChange,
  onEventTypeChange,
  onRegionChange,
}: {
  start_date: string;
  end_date: string;
  selectedRange: string;
  eventTypeFilter: "all" | "1st F" | "2nd F" | "3rd F";
  regionFilter: "all" | string;
  regions: { id:  string; name: string }[];
  onRangeChange: (range: string, start: string, end: string) => void;
  onEventTypeChange: (type: "all" | "1st F" | "2nd F" | "3rd F") => void;
  onRegionChange: (regionId: "all" | string) => void;
}) {
  const handleRangeChange = (option: string) => {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    let start: Date;
    let end: Date = todayUTC;

    switch (option) {
      case "All History":
        start = new Date(0);
        break;
      case "YTD":
        start = new Date(Date.UTC(todayUTC.getUTCFullYear(), 0, 1));
        break;
      case "Current Month":
        start = new Date(
          Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)
        );
        break;
      case "Last 90 Days":
        start = new Date(todayUTC.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "Last 180 Days":
        start = new Date(todayUTC.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "Prior Year":
        start = new Date(Date.UTC(todayUTC.getUTCFullYear() - 1, 0, 1));
        end = new Date(Date.UTC(todayUTC.getUTCFullYear() - 1, 11, 31));
        break;
      default:
        start = new Date(0);
    }

    console.log("Rendering DateFilter with:", {
      start_date,
      end_date,
      selectedRange: option,
    });
    onRangeChange(option, toUTCDateString(start), toUTCDateString(end));
  };
  
  return (
    <div className="flex w-full gap-2">
      {/* Event type dropdown */}
      <Dropdown backdrop="blur">
        <DropdownTrigger>
          <Button
            variant="flat"
            className="flex-1"
          >
            {eventTypeFilter === "all" ? "All Event Types" : eventTypeFilter}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          disallowEmptySelection
          selectionMode="single"
          onAction={(key) =>
            onEventTypeChange(key as "all" | "1st F" | "2nd F" | "3rd F")
          }
        >
          <DropdownItem key="all">All Event Types</DropdownItem>
          <DropdownItem key="1st F">1st F</DropdownItem>
          <DropdownItem key="2nd F">2nd F</DropdownItem>
          <DropdownItem key="3rd F">3rd F</DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Region dropdown */}
      <Dropdown backdrop="blur">
        <DropdownTrigger>
          <Button
            variant="flat"
            className="flex-1"
          >
            {regionFilter === "all"
              ? "All Regions"
              : regions.find((r) => r.id === regionFilter)?.name || "Select Region"}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          disallowEmptySelection
          selectionMode="single"
          onAction={(key) =>
            onRegionChange(key as "all" | string)
          }
        >
          {[
            <DropdownItem key="all">All Regions</DropdownItem>,
            ...regions.map((region) => (
              <DropdownItem key={region.id}>{region.name}</DropdownItem>
            ))
          ]}
        </DropdownMenu>
      </Dropdown>

      {/* Date range dropdown */}
      <Dropdown backdrop="blur" placement="bottom-end">
        <DropdownTrigger>
          <Button
            variant="flat"
            className="flex-1"
          >
            {selectedRange}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          disallowEmptySelection
          selectionMode="single"
          onAction={(key) => {
            const value = key as string;
            handleRangeChange(value);
          }}
        >
          {["All History", "YTD", "Current Month", "Last 90 Days", "Last 180 Days", "Prior Year"].map(
            (option) => (
              <DropdownItem key={option}>{option}</DropdownItem>
            )
          )}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
