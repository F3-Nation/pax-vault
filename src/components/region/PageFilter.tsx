"use client";

import { Button } from "@heroui/button";
import { ButtonGroup } from "@heroui/button";
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
  onRangeChange,
}: {
  start_date: string;
  end_date: string;
  selectedRange: string;
  onRangeChange: (range: string, start: string, end: string) => void;
}) {
  const handlePredefinedRange = (range: string) => {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    let start: Date;
    const end: Date = todayUTC;

    switch (range) {
      case "Overall":
        start = new Date(0);
        break;
      case "YTD":
        start = new Date(Date.UTC(todayUTC.getUTCFullYear(), 0, 1));
        break;
      case "Current Month":
        start = new Date(
          Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1),
        );
        break;
      default:
        start = new Date(0);
    }
    console.log("Rendering DateFilter with:", {
      start_date,
      end_date,
      selectedRange,
    });
    onRangeChange(range, toUTCDateString(start), toUTCDateString(end));
  };

  const handleCustomRange = (option: string) => {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    let start: Date;
    let end: Date = todayUTC;

    switch (option) {
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
      selectedRange,
    });
    onRangeChange(option, toUTCDateString(start), toUTCDateString(end));
  };

  return (
    <ButtonGroup className="w-full">
      {["Overall", "YTD", "Current Month"].map((range) => (
        <Button
          key={range}
          variant={selectedRange === range ? "solid" : "ghost"}
          color={selectedRange === range ? "primary" : "default"}
          className="flex-1"
          onClick={() => handlePredefinedRange(range)}
        >
          {range}
        </Button>
      ))}
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            variant={
              selectedRange !== "Overall" &&
              selectedRange !== "YTD" &&
              selectedRange !== "Current Month"
                ? "solid"
                : "ghost"
            }
            color={
              selectedRange !== "Overall" &&
              selectedRange !== "YTD" &&
              selectedRange !== "Current Month"
                ? "primary"
                : "default"
            }
            className="flex-1"
          >
            {["Overall", "YTD", "Current Month"].includes(selectedRange)
              ? "Custom"
              : selectedRange}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          disallowEmptySelection
          selectionMode="single"
          onAction={(key) => handleCustomRange(key as string)}
        >
          {["Last 90 Days", "Last 180 Days", "Prior Year"].map((option) => (
            <DropdownItem key={option}>{option}</DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </ButtonGroup>
  );
}
