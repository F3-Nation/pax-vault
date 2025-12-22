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
  selectedRange,
  eventTypeFilter,
  aoFilter,
  aos,
  onRangeChange,
  onEventTypeChange,
  onAOChange,
}: {
  selectedRange: string;
  eventTypeFilter: "all" | "1st F" | "2nd F" | "3rd F";
  aoFilter: "all" | string;
  aos: { id: string; name: string }[];
  onRangeChange: (range: string, start: string, end: string) => void;
  onEventTypeChange: (type: "all" | "1st F" | "2nd F" | "3rd F") => void;
  onAOChange: (aoId: "all" | string) => void;
}) {
  const handleRangeChange = (option: string) => {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const futureUTC = new Date(Date.UTC(2050, 11, 31));

    let start: Date;
    let end: Date = futureUTC;

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

    onRangeChange(option, toUTCDateString(start), toUTCDateString(end));
  };

  return (
    <div className="flex w-full gap-2">
      {/* Event type dropdown */}
      <Dropdown backdrop="blur">
        <DropdownTrigger>
          <Button variant="flat" className="flex-1">
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
          <Button variant="flat" className="flex-1">
            {aoFilter === "all"
              ? "All AOs"
              : aos.find((r) => r.id === aoFilter)?.name || "Select AO"}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          disallowEmptySelection
          selectionMode="single"
          onAction={(key) => onAOChange(key as "all" | string)}
        >
          {[
            <DropdownItem key="all">All AOs</DropdownItem>,
            ...aos.map((ao: { id: string; name: string }) => (
              <DropdownItem key={ao.id}>{ao.name}</DropdownItem>
            )),
          ]}
        </DropdownMenu>
      </Dropdown>

      {/* Date range dropdown */}
      <Dropdown backdrop="blur" placement="bottom-end">
        <DropdownTrigger>
          <Button variant="flat" className="flex-1">
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
          {[
            "All History",
            "YTD",
            "Current Month",
            "Last 90 Days",
            "Last 180 Days",
            "Prior Year",
          ].map((option) => (
            <DropdownItem key={option}>{option}</DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
