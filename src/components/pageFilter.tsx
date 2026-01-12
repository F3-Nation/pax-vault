"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@heroui/button";
import { CopyIcon, CloseIcon, FilterIcon } from "@/components/icons"; // Assume this is the copy icon component
import { DateRangePicker } from "@heroui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
} from "@heroui/drawer";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { RadioGroup, Radio } from "@heroui/radio";
import { CheckboxGroup, Checkbox } from "@heroui/checkbox";
import { useDisclosure } from "@heroui/use-disclosure";

function toUTCDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

export function Filter({
  selectedRange,
  startDate,
  endDate,
  categoryFilter,
  aoFilter,
  aos,
  regionFilter,
  regions,
  typesFilter,
  types,
  tagsFilter,
  tags,
  onRangeChange,
  onCategoryChange,
  onAOChange,
  onRegionChange,
  onTypeChange,
  onTagChange,
}: {
  selectedRange: string;
  startDate?: string;
  endDate?: string;
  categoryFilter: "all" | string[];
  aoFilter?: "all" | string[];
  aos?: { id: string; name: string }[];
  regionFilter?: "all" | string[];
  regions?: { id: string; name: string }[];
  typesFilter: "all" | string[];
  types: string[];
  tagsFilter: "all" | string[];
  tags: string[];
  onRangeChange: (range: string, start: string, end: string) => void;
  onCategoryChange: (category: "all" | string[]) => void;
  onAOChange?: (aoId: "all" | string[]) => void;
  onRegionChange?: (regionId: "all" | string[]) => void;
  onTypeChange: (type: "all" | string[]) => void;
  onTagChange: (tag: "all" | string[]) => void;
}) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Trigger initial range calculation if coming from URL params
    if (selectedRange && selectedRange !== "All History") {
      handleRangeChange(selectedRange, startDate, endDate);
    }

    // Trigger initial category filter
    if (categoryFilter && categoryFilter !== "all") {
      onCategoryChange(categoryFilter);
    }

    // Trigger initial AO filter
    if (aoFilter && aoFilter !== "all") {
      onAOChange?.(aoFilter);
    }

    // Trigger initial Region filter
    if (regionFilter && regionFilter !== "all") {
      onRegionChange?.(regionFilter);
    }

    // Trigger initial Type filter
    if (typesFilter && typesFilter !== "all") {
      onTypeChange(typesFilter);
    }

    // Trigger initial Tag filter
    if (tagsFilter && tagsFilter !== "all") {
      onTagChange(tagsFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRangeChange = (
    option: string,
    customStart?: string,
    customEnd?: string,
  ) => {
    const now = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
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
          Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1),
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
        start = customStart ? new Date(customStart) : new Date(0);
        end = customEnd ? new Date(customEnd) : futureUTC;
    }

    onRangeChange(option, toUTCDateString(start), toUTCDateString(end));
  };

  // Memoize shareUrl to avoid creating new URLSearchParams on every render
  const shareUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (selectedRange === "Custom" && startDate && endDate) {
      params.set("range", "Custom");
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    } else if (selectedRange && selectedRange !== "All History") {
      params.set("range", selectedRange);
    }

    if (categoryFilter !== "all") {
      categoryFilter.forEach((t) => params.append("category", t));
    }

    if (aoFilter !== "all" && aoFilter) {
      aoFilter.forEach((id) => params.append("aoID", id));
    }

    if (regionFilter !== "all" && regionFilter) {
      regionFilter.forEach((id) => params.append("regionID", id));
    }

    if (typesFilter !== "all") {
      typesFilter.forEach((t) => params.append("types", t));
    }

    if (tagsFilter !== "all") {
      tagsFilter.forEach((t) => params.append("tags", t));
    }

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [
    selectedRange,
    startDate,
    endDate,
    categoryFilter,
    aoFilter,
    regionFilter,
    typesFilter,
    tagsFilter,
  ]);

  return (
    <>
      <div className="flex w-full gap-2">
        <Drawer
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          hideCloseButton
          backdrop="opaque"
          placement="left"
          radius="none"
          className="bg-white/50 dark:bg-gray-900/80"
        >
          <DrawerContent>
            <DrawerHeader className="flex flex-col gap-1 text-foreground relative">
              Filter Options
              <div className="absolute right-2 top-2">
                <div className="relative">
                  <Button
                    variant="light"
                    aria-label="Copy share URL"
                    isIconOnly
                    onPress={async () => {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1000);
                    }}
                  >
                    <CopyIcon width={20} height={20} />
                  </Button>
                  <Button
                    variant="light"
                    aria-label="Close filter drawer"
                    isIconOnly
                    onPress={() => onOpenChange()}
                    className="ml-2"
                  >
                    <CloseIcon width={20} height={20} />
                  </Button>

                  {copied && (
                    <div
                      className="absolute right-0 mt-2 px-2 py-1 rounded bg-black text-white text-xs z-10 shadow"
                      style={{ minWidth: "60px", textAlign: "center" }}
                    >
                      Copied To Clipboard!
                    </div>
                  )}
                </div>
              </div>
            </DrawerHeader>
            <DrawerBody>
              <Accordion variant="splitted" selectionMode="multiple">
                <AccordionItem
                  key="date-filter"
                  aria-label="Filter by Date Range"
                  aria-expanded={
                    selectedRange !== "All History" ? "true" : "false"
                  }
                  title="Filter by Date Range"
                  subtitle="Select a date range for events"
                  className="mb-4"
                >
                  <div className="space-y-3">
                    <RadioGroup
                      value={selectedRange}
                      onValueChange={(value) => handleRangeChange(value)}
                    >
                      {[
                        "YTD",
                        "Current Month",
                        "Last 90 Days",
                        "Last 180 Days",
                        "Prior Year",
                        "Custom",
                      ].map((option) => (
                        <Radio key={option} value={option}>
                          {option}
                        </Radio>
                      ))}
                    </RadioGroup>

                    {selectedRange === "Custom" && (
                      <div>
                        <DateRangePicker
                          variant="bordered"
                          firstDayOfWeek="mon"
                          onChange={(range) => {
                            if (!range?.start || !range?.end) return;
                            const start = toUTCDateString(
                              range.start.toDate("UTC"),
                            );
                            const end = toUTCDateString(
                              range.end.toDate("UTC"),
                            );
                            const option = "Custom";
                            handleRangeChange(option, start, end);
                          }}
                        />
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => handleRangeChange("All History")}
                      className="w-full"
                    >
                      Clear Filter
                    </Button>
                  </div>
                </AccordionItem>
                {regionFilter &&
                onRegionChange &&
                regions &&
                regions.length > 1 ? (
                  <AccordionItem
                    key="region-filter"
                    aria-label="Filter by Region"
                    aria-expanded={regionFilter !== "all" ? "true" : "false"}
                    title="Filter by Region"
                    subtitle="Select one or more Regions"
                    className="mb-4"
                  >
                    <div className="space-y-3">
                      <CheckboxGroup
                        value={regionFilter === "all" ? [] : regionFilter}
                        onValueChange={(value) => onRegionChange?.(value)}
                      >
                        {regions.map((option) => (
                          <Checkbox key={option.id} value={option.id}>
                            {option.name}
                          </Checkbox>
                        ))}
                      </CheckboxGroup>

                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => onRegionChange("all")}
                        className="w-full"
                      >
                        Clear Filter
                      </Button>
                    </div>
                  </AccordionItem>
                ) : null}
                {aoFilter && onAOChange && aos && aos.length > 1 ? (
                  <AccordionItem
                    key="ao-filter"
                    aria-label="Filter by AO"
                    aria-expanded={aoFilter !== "all" ? "true" : "false"}
                    title="Filter by AO"
                    subtitle="Select one or more AOs"
                    className="mb-4"
                  >
                    <div className="space-y-3">
                      <CheckboxGroup
                        value={aoFilter === "all" ? [] : aoFilter}
                        onValueChange={(value) => onAOChange?.(value)}
                      >
                        {aos.map((option) => (
                          <Checkbox key={option.id} value={option.id}>
                            {option.name}
                          </Checkbox>
                        ))}
                      </CheckboxGroup>

                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => onAOChange("all")}
                        className="w-full"
                      >
                        Clear Filter
                      </Button>
                    </div>
                  </AccordionItem>
                ) : null}
                <AccordionItem
                  key="event-category-filter"
                  aria-label="Filter by Event Category"
                  aria-expanded={categoryFilter !== "all" ? "true" : "false"}
                  title="Filter by Event Category"
                  subtitle="Select one or more event categories"
                  className="mb-4"
                >
                  <div className="space-y-3">
                    <CheckboxGroup
                      value={categoryFilter === "all" ? [] : categoryFilter}
                      onValueChange={(value) => onCategoryChange(value)}
                    >
                      {["1st F", "2nd F", "3rd F"].map((option) => (
                        <Checkbox key={option} value={option}>
                          {option}
                        </Checkbox>
                      ))}
                    </CheckboxGroup>

                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => onCategoryChange("all")}
                      className="w-full"
                    >
                      Clear Filter
                    </Button>
                  </div>
                </AccordionItem>
                {types.length > 0 ? (
                  <AccordionItem
                    key="type-filter"
                    aria-label="Filter by Type"
                    aria-expanded={typesFilter !== "all" ? "true" : "false"}
                    title="Filter by Type"
                    subtitle="Select one or more Types"
                    className="mb-4"
                  >
                    <div className="space-y-3">
                      <CheckboxGroup
                        value={typesFilter === "all" ? [] : typesFilter}
                        onValueChange={(value) => onTypeChange(value)}
                      >
                        {typesFilter !== "all" &&
                          types.map((option) => (
                            <Checkbox key={option} value={option}>
                              {option}
                            </Checkbox>
                          ))}
                      </CheckboxGroup>

                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => onTypeChange("all")}
                        className="w-full"
                      >
                        Clear Filter
                      </Button>
                    </div>
                  </AccordionItem>
                ) : null}
                {tags.length > 0 ? (
                  <AccordionItem
                    key="tag-filter"
                    aria-label="Filter by Tag"
                    aria-expanded={tagsFilter !== "all" ? "true" : "false"}
                    title="Filter by Tag"
                    subtitle="Select one or more Tags"
                  >
                    <div className="space-y-3">
                      <CheckboxGroup
                        value={tagsFilter === "all" ? [] : tagsFilter}
                        onValueChange={(value) => onTagChange(value)}
                      >
                        {tagsFilter !== "all" &&
                          tags.map((option) => (
                            <Checkbox key={option} value={option}>
                              {option}
                            </Checkbox>
                          ))}
                      </CheckboxGroup>

                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => onTagChange("all")}
                        className="w-full"
                      >
                        Clear Filter
                      </Button>
                    </div>
                  </AccordionItem>
                ) : null}
              </Accordion>
              <div className="mx-3">
                <Button
                  size="md"
                  variant="bordered"
                  color="danger"
                  onPress={() => {
                    handleRangeChange("All History");
                    onAOChange?.("all");
                    onRegionChange?.("all");
                    onCategoryChange("all");
                    onTypeChange("all");
                    onTagChange("all");
                  }}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              </div>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </div>
      {/* Mobile bottom bar (sm screens only) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/50 dark:bg-gray-900/50 p-2 border-t border-gray-300 dark:border-gray-700 z-50">
        <Button size="md" color="primary" className="w-full" onPress={onOpen}>
          Apply Filters
        </Button>
      </div>
      {/* Floating button for md+ screens */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50">
        <Button
          variant="ghost"
          size="md"
          aria-label="Close filter drawer"
          startContent={<FilterIcon />}
          // isIconOnly
          onPress={onOpen}
        >
          Apply Filters
        </Button>
      </div>
    </>
  );
}
