"use client";

/**
 * Page-level Filters (Drawer)
 *
 * Provides a consistent filter UI for region pages.
 *
 * Responsibilities:
 * - Parse incoming filter query-string into local UI state.
 * - Build a shareable URL (copy + apply).
 * - Keep accordion sections expanded when filters are active.
 */
type FilterProps = {
  aos?: { ao_org_id: number; ao_name: string }[];
  regions?: { region_org_id: number; region_name: string }[];
  types: { type_id: number; type_name: string }[];
  tags: { tag_id: number; tag_name: string }[];
  /** Raw query-string (no leading `?`) passed from page wrapper */
  filters: string;
};

type RangeKey =
  | "All History"
  | "This Week"
  | "Last Week"
  | "This Month"
  | "Last Month"
  | "Last 90 Days"
  | "Last 180 Days"
  | "YTD"
  | "Prior Year"
  | "Custom";

type IncludeExclude = "include" | "exclude";

const ALL_HISTORY: RangeKey = "All History";

const ACCORDION_KEYS = {
  DATE: "date-filter",
  AO: "ao-filter",
  REGION: "region-filter",
  TAG: "tag-filter",
  TYPE: "type-filter",
  CATEGORY: "category-filter",
} as const;

/**
 * Parse a comma-separated id list from the query-string.
 */
function parseIdList(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/**
 * Convert a Date to an ISO `YYYY-MM-DD` string in UTC.
 */
function toUTCDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { Switch } from "@heroui/switch";

export function Filter({ aos, regions, types, tags, filters }: FilterProps) {
  // Drawer open/close state
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  // UI feedback state
  const [copied, setCopied] = useState(false);
  // Filter UI state
  const [rangeState, setRangeState] = useState<RangeKey>(ALL_HISTORY);
  const [isSelected_aoMode, setIsSelected_aoMode] = useState(false);
  const [aoState, setAOState] = useState<"all" | string[]>("all");
  const [isSelected_regionMode, setIsSelected_regionMode] = useState(false);
  const [regionState, setRegionState] = useState<"all" | string[]>("all");
  const [isSelected_tagMode, setIsSelected_tagMode] = useState(false);
  const [tagState, setTagState] = useState<"all" | string[]>("all");
  const [isSelected_typeMode, setIsSelected_typeMode] = useState(false);
  const [typeState, setTypeState] = useState<"all" | string[]>("all");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [isSelected_categoryMode, setIsSelected_categoryMode] = useState(false);
  const [categoryState, setCategoryState] = useState<"all" | string[]>("all");

  const parsedFilters = useMemo(() => {
    const sp = new URLSearchParams(filters ?? "");

    const rangeParam = (sp.get("range") as RangeKey | null) ?? ALL_HISTORY;

    return {
      range: rangeParam,
      startDate: sp.get("startDate"),
      endDate: sp.get("endDate"),
      aoMode: (sp.get("aoMode") === "exclude"
        ? "exclude"
        : "include") as IncludeExclude,
      aoIds: parseIdList(sp.get("aoIds")),
      regionMode: (sp.get("regionMode") === "exclude"
        ? "exclude"
        : "include") as IncludeExclude,
      regionIds: parseIdList(sp.get("regionIds")),
      tagMode: (sp.get("tagMode") === "exclude"
        ? "exclude"
        : "include") as IncludeExclude,
      tagIds: parseIdList(sp.get("tagIds")),
      typeMode: (sp.get("typeMode") === "exclude"
        ? "exclude"
        : "include") as IncludeExclude,
      typeIds: parseIdList(sp.get("typeIds")),
      categoryMode: (sp.get("categoryMode") === "exclude"
        ? "exclude"
        : "include") as IncludeExclude,
      categoryIds: parseIdList(sp.get("categoryIds")),
    };
  }, [filters]);

  // Expand accordion sections that have active filters (or expand all if none are active).
  const computedExpandedKeys = useMemo(() => {
    const rangeOpen = parsedFilters.range !== ALL_HISTORY;
    const aoOpen =
      parsedFilters.aoIds.length > 0 || parsedFilters.aoMode === "exclude";
    const regionOpen =
      parsedFilters.regionIds.length > 0 ||
      parsedFilters.regionMode === "exclude";
    const tagOpen =
      parsedFilters.tagIds.length > 0 || parsedFilters.tagMode === "exclude";
    const typeOpen =
      parsedFilters.typeIds.length > 0 || parsedFilters.typeMode === "exclude";
    const categoryOpen =
      parsedFilters.categoryIds.length > 0 ||
      parsedFilters.categoryMode === "exclude";

    const anyOpen =
      aoOpen || tagOpen || typeOpen || rangeOpen || categoryOpen || regionOpen;

    if (!anyOpen)
      return [
        ACCORDION_KEYS.DATE,
        ACCORDION_KEYS.REGION,
        ACCORDION_KEYS.AO,
        ACCORDION_KEYS.TAG,
        ACCORDION_KEYS.TYPE,
        ACCORDION_KEYS.CATEGORY,
      ];
    const keys: string[] = [];
    if (aoOpen) keys.push(ACCORDION_KEYS.AO);
    if (regionOpen) keys.push(ACCORDION_KEYS.REGION);
    if (tagOpen) keys.push(ACCORDION_KEYS.TAG);
    if (typeOpen) keys.push(ACCORDION_KEYS.TYPE);
    if (rangeOpen) keys.push(ACCORDION_KEYS.DATE);
    if (categoryOpen) keys.push(ACCORDION_KEYS.CATEGORY);
    return keys;
  }, [parsedFilters]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(computedExpandedKeys),
  );

  // Move Next.js router hooks above shareUrl for readability
  const router = useRouter();
  const pathname = usePathname();
  /**
   * Build a shareable URL reflecting current local filter state.
   */
  const shareUrl = () => {
    const params = new URLSearchParams();

    // Date range
    if (rangeState !== ALL_HISTORY) {
      if (rangeState === "Custom") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      } else {
        params.set("range", rangeState);
      }
    }

    const appendIds = (
      key: string,
      state: "all" | string[],
      modeKey: string,
      exclude: boolean,
    ) => {
      if (state === "all") return;
      params.set(key, Array.isArray(state) ? state.join(",") : String(state));
      if (exclude) params.set(modeKey, "exclude");
    };

    appendIds("aoIds", aoState, "aoMode", isSelected_aoMode);
    appendIds("regionIds", regionState, "regionMode", isSelected_regionMode);
    appendIds("tagIds", tagState, "tagMode", isSelected_tagMode);
    appendIds("typeIds", typeState, "typeMode", isSelected_typeMode);
    appendIds(
      "categoryIds",
      categoryState,
      "categoryMode",
      isSelected_categoryMode,
    );

    const qs = params.toString();
    return `${window.location.origin}${pathname}${qs ? `?${qs}` : ""}`;
  };

  // Small helpers for clearing state
  const clearDate = () => {
    setRangeState(ALL_HISTORY);
    setStartDate(null);
    setEndDate(null);
  };

  const clearAO = () => {
    setAOState("all");
    setIsSelected_aoMode(false);
  };

  const clearRegion = () => {
    setRegionState("all");
    setIsSelected_regionMode(false);
  };

  const clearTags = () => {
    setTagState("all");
    setIsSelected_tagMode(false);
  };

  const clearTypes = () => {
    setTypeState("all");
    setIsSelected_typeMode(false);
  };

  const clearCategories = () => {
    setCategoryState("all");
    setIsSelected_categoryMode(false);
  };

  const clearAll = () => {
    clearDate();
    clearAO();
    clearRegion();
    clearTags();
    clearTypes();
    clearCategories();
  };

  useEffect(() => {
    // Sync Date Range
    setRangeState((parsedFilters.range as typeof rangeState) || "All History");

    // Sync Start and End Dates
    setStartDate(parsedFilters.startDate);
    setEndDate(parsedFilters.endDate);

    // Sync AO
    setIsSelected_aoMode(parsedFilters.aoMode === "exclude");
    setAOState(parsedFilters.aoIds.length > 0 ? parsedFilters.aoIds : "all");

    // Sync Tag
    setIsSelected_tagMode(parsedFilters.tagMode === "exclude");
    setTagState(parsedFilters.tagIds.length > 0 ? parsedFilters.tagIds : "all");

    // Sync Type
    setIsSelected_typeMode(parsedFilters.typeMode === "exclude");
    setTypeState(
      parsedFilters.typeIds.length > 0 ? parsedFilters.typeIds : "all",
    );

    // Sync Category
    setIsSelected_categoryMode(parsedFilters.categoryMode === "exclude");
    setCategoryState(
      parsedFilters.categoryIds.length > 0 ? parsedFilters.categoryIds : "all",
    );

    // Sync Accordion expansion based on active filters
    setExpandedKeys(new Set(computedExpandedKeys));
  }, [parsedFilters, computedExpandedKeys]);

  return (
    <>
      <div className="flex w-full gap-2">
        <Drawer
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          hideCloseButton
          isDismissable={false}
          backdrop="blur"
          placement="left"
          radius="none"
          className="bg-white/50 dark:bg-gray-900/80"
        >
          <DrawerContent className="h-full flex flex-col">
            {(onClose) => (
              <>
                <DrawerHeader className="flex flex-col gap-1 text-foreground relative">
                  Filter Options
                  <div className="absolute right-2 top-2">
                    <div className="relative">
                      <Button
                        variant="light"
                        aria-label="Copy share URL"
                        isIconOnly
                        onPress={async () => {
                          await navigator.clipboard.writeText(shareUrl());
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
                        onPress={onClose}
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
                <DrawerBody className="flex-1 overflow-y-auto">
                  <Accordion
                    isCompact
                    variant="splitted"
                    selectionMode="multiple"
                    selectedKeys={expandedKeys}
                    onSelectionChange={(keys) => {
                      // HeroUI passes Selection; normalize to Set<string>
                      if (keys === "all") {
                        setExpandedKeys(
                          new Set([
                            ACCORDION_KEYS.DATE,
                            ACCORDION_KEYS.REGION,
                            ACCORDION_KEYS.AO,
                            ACCORDION_KEYS.TAG,
                            ACCORDION_KEYS.TYPE,
                            ACCORDION_KEYS.CATEGORY,
                          ]),
                        );
                        return;
                      }
                      setExpandedKeys(new Set(Array.from(keys as Set<string>)));
                    }}
                  >
                    <AccordionItem
                      key={ACCORDION_KEYS.DATE}
                      aria-label="Filter by Date Range"
                      title="Filter by Date Range"
                      subtitle="Select a date range for events"
                      className="mb-4"
                    >
                      <div className="space-y-3">
                        <RadioGroup
                          value={rangeState}
                          onValueChange={(value) =>
                            setRangeState(value as RangeKey)
                          }
                        >
                          {[
                            "This Week",
                            "Last Week",
                            "This Month",
                            "Last Month",
                            "Last 90 Days",
                            "Last 180 Days",
                            "YTD",
                            "Prior Year",
                            "Custom",
                          ].map((option) => (
                            <Radio key={option} value={option}>
                              {option}
                            </Radio>
                          ))}
                        </RadioGroup>

                        {rangeState === "Custom" && (
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
                                setRangeState(option);
                                setStartDate(start);
                                setEndDate(end);
                              }}
                            />
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={clearDate}
                          className="w-full"
                        >
                          Clear Filter
                        </Button>
                      </div>
                    </AccordionItem>
                    {regions && regions.length > 1 ? (
                      <AccordionItem
                        key={ACCORDION_KEYS.REGION}
                        aria-label="Filter by Region"
                        title="Filter by Region"
                        subtitle="Select one or more Regions"
                        className="mb-4"
                      >
                        <div className="space-y-3">
                          <Switch
                            size="sm"
                            color="danger"
                            isSelected={isSelected_regionMode}
                            onValueChange={(value) => {
                              setIsSelected_regionMode(value);
                            }}
                          >
                            <span
                              className={`italic text-sm ${
                                isSelected_regionMode
                                  ? "text-danger"
                                  : "text-gray-500"
                              }`}
                            >
                              Exclude Selected Regions
                            </span>
                          </Switch>
                          <CheckboxGroup
                            value={regionState === "all" ? [] : regionState}
                            onValueChange={(value) => {
                              const v = value.length ? value : "all";
                              setRegionState(v);
                            }}
                          >
                            {regions.map((option) => (
                              <Checkbox
                                icon={
                                  isSelected_regionMode ? (
                                    <CloseIcon />
                                  ) : undefined
                                }
                                radius="none"
                                color={
                                  isSelected_regionMode ? "danger" : "primary"
                                }
                                lineThrough={isSelected_regionMode}
                                key={option.region_org_id}
                                value={String(option.region_org_id)}
                              >
                                {option.region_name}
                              </Checkbox>
                            ))}
                          </CheckboxGroup>

                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={clearRegion}
                            className="w-full"
                          >
                            Clear Filter
                          </Button>
                        </div>
                      </AccordionItem>
                    ) : null}
                    {aos && aos.length > 1 ? (
                      <AccordionItem
                        key={ACCORDION_KEYS.AO}
                        aria-label="Filter by AO"
                        title="Filter by AO"
                        subtitle="Select one or more AOs"
                        className="mb-4"
                      >
                        <div className="space-y-3">
                          <Switch
                            size="sm"
                            color="danger"
                            isSelected={isSelected_aoMode}
                            onValueChange={(value) => {
                              setIsSelected_aoMode(value);
                            }}
                          >
                            <span
                              className={`italic text-sm ${
                                isSelected_aoMode
                                  ? "text-danger"
                                  : "text-gray-500"
                              }`}
                            >
                              Exclude Selected AOs
                            </span>
                          </Switch>
                          <CheckboxGroup
                            value={aoState === "all" ? [] : aoState}
                            onValueChange={(value) => {
                              const v = value.length ? value : "all";
                              setAOState(v);
                            }}
                          >
                            {aos.map((option) => (
                              <Checkbox
                                icon={
                                  isSelected_aoMode ? <CloseIcon /> : undefined
                                }
                                radius="none"
                                color={isSelected_aoMode ? "danger" : "primary"}
                                lineThrough={isSelected_aoMode}
                                key={option.ao_org_id}
                                value={String(option.ao_org_id)}
                              >
                                {option.ao_name}
                              </Checkbox>
                            ))}
                            <Checkbox
                              icon={
                                isSelected_aoMode ? <CloseIcon /> : undefined
                              }
                              radius="none"
                              color={isSelected_aoMode ? "danger" : "primary"}
                              lineThrough={isSelected_aoMode}
                              key={0}
                              value={String(0)}
                            >
                              Unknown AO
                            </Checkbox>
                          </CheckboxGroup>

                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={clearAO}
                            className="w-full"
                          >
                            Clear Filter
                          </Button>
                        </div>
                      </AccordionItem>
                    ) : null}
                    {tags && tags.length > 1 ? (
                      <AccordionItem
                        key={ACCORDION_KEYS.TAG}
                        aria-label="Filter by Tag"
                        title="Filter by Tag"
                        subtitle="Select one or more Tags"
                        className="mb-4"
                      >
                        <div className="space-y-3">
                          <Switch
                            size="sm"
                            color="danger"
                            isSelected={isSelected_tagMode}
                            onValueChange={(value) => {
                              setIsSelected_tagMode(value);
                            }}
                          >
                            <span
                              className={`italic text-sm ${
                                isSelected_tagMode
                                  ? "text-danger"
                                  : "text-gray-500"
                              }`}
                            >
                              Exclude Selected Tags
                            </span>
                          </Switch>
                          <CheckboxGroup
                            value={tagState === "all" ? [] : tagState}
                            onValueChange={(value) => {
                              const v = value.length ? value : "all";
                              setTagState(v);
                            }}
                          >
                            {tags.map((option) => (
                              <Checkbox
                                icon={
                                  isSelected_tagMode ? <CloseIcon /> : undefined
                                }
                                radius="none"
                                color={
                                  isSelected_tagMode ? "danger" : "primary"
                                }
                                lineThrough={isSelected_tagMode}
                                key={option.tag_id}
                                value={String(option.tag_id)}
                              >
                                {option.tag_name}
                              </Checkbox>
                            ))}
                          </CheckboxGroup>

                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={clearTags}
                            className="w-full"
                          >
                            Clear Filter
                          </Button>
                        </div>
                      </AccordionItem>
                    ) : null}
                    {types && types.length > 1 ? (
                      <AccordionItem
                        key={ACCORDION_KEYS.TYPE}
                        aria-label="Filter by Type"
                        title="Filter by Type"
                        subtitle="Select one or more Types"
                        className="mb-4"
                      >
                        <div className="space-y-3">
                          <Switch
                            size="sm"
                            color="danger"
                            isSelected={isSelected_typeMode}
                            onValueChange={(value) => {
                              setIsSelected_typeMode(value);
                            }}
                          >
                            <span
                              className={`italic text-sm ${
                                isSelected_typeMode
                                  ? "text-danger"
                                  : "text-gray-500"
                              }`}
                            >
                              Exclude Selected Types
                            </span>
                          </Switch>
                          <CheckboxGroup
                            value={typeState === "all" ? [] : typeState}
                            onValueChange={(value) => {
                              const v = value.length ? value : "all";
                              setTypeState(v);
                            }}
                          >
                            {types.map((option) => (
                              <Checkbox
                                icon={
                                  isSelected_typeMode ? (
                                    <CloseIcon />
                                  ) : undefined
                                }
                                radius="none"
                                color={
                                  isSelected_typeMode ? "danger" : "primary"
                                }
                                lineThrough={isSelected_typeMode}
                                key={option.type_id}
                                value={String(option.type_id)}
                              >
                                {option.type_name}
                              </Checkbox>
                            ))}
                          </CheckboxGroup>

                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={clearTypes}
                            className="w-full"
                          >
                            Clear Filter
                          </Button>
                        </div>
                      </AccordionItem>
                    ) : null}
                    <AccordionItem
                      key={ACCORDION_KEYS.CATEGORY}
                      aria-label="Filter by Event Category"
                      title="Filter by Event Category"
                      subtitle="Select one or more event categories"
                      className="mb-4"
                    >
                      <div className="space-y-3">
                        <Switch
                          size="sm"
                          color="danger"
                          isSelected={isSelected_categoryMode}
                          onValueChange={(value) => {
                            setIsSelected_categoryMode(value);
                          }}
                        >
                          <span
                            className={`italic text-sm ${
                              isSelected_categoryMode
                                ? "text-danger"
                                : "text-gray-500"
                            }`}
                          >
                            Exclude Selected Categories
                          </span>
                        </Switch>
                        <CheckboxGroup
                          value={categoryState === "all" ? [] : categoryState}
                          onValueChange={(value) => {
                            const v = value.length ? value : "all";
                            setCategoryState(v);
                          }}
                        >
                          {[
                            { category_id: "1", category_name: "1st F" },
                            { category_id: "2", category_name: "2nd F" },
                            { category_id: "3", category_name: "3rd F" },
                          ].map((option) => (
                            <Checkbox
                              icon={
                                isSelected_categoryMode ? (
                                  <CloseIcon />
                                ) : undefined
                              }
                              radius="none"
                              color={
                                isSelected_categoryMode ? "danger" : "default"
                              }
                              lineThrough={isSelected_categoryMode}
                              key={option.category_id}
                              value={option.category_id}
                            >
                              {option.category_name}
                            </Checkbox>
                          ))}
                        </CheckboxGroup>

                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={clearCategories}
                          className="w-full"
                        >
                          Clear Filter
                        </Button>
                      </div>
                    </AccordionItem>
                  </Accordion>
                  {/* Sticky action bar keeps Apply/Clear visible while scrolling */}
                  <div className="sticky bottom-0 left-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur pb-4">
                    <div className="flex flex-row space-x-2">
                      <Button
                        size="md"
                        variant="bordered"
                        color="danger"
                        onPress={clearAll}
                        className="w-full"
                      >
                        Clear All Filters
                      </Button>
                      <Button
                        size="md"
                        color="primary"
                        onPress={() => {
                          const url = shareUrl();
                          const next = url.replace(window.location.origin, "");
                          router.push(next);
                          onClose();
                        }}
                        className="w-full mb-2"
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </DrawerBody>
              </>
            )}
          </DrawerContent>
        </Drawer>
      </div>
      {/* Mobile bottom bar (sm screens only) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/50 dark:bg-gray-900/50 p-2 border-t border-gray-300 dark:border-gray-700 z-50">
        <Button size="md" color="primary" className="w-full" onPress={onOpen}>
          Filters
        </Button>
      </div>
      {/* Floating button for md+ screens */}
      <div className="hidden md:block fixed bottom-6 right-6 z-50">
        <Button
          variant="bordered"
          size="lg"
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
