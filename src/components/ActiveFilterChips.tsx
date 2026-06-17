"use client";

/**
 * ActiveFilterChips
 *
 * Shows the currently-applied filters as chips above the filter drawer. Each
 * value chip is removable — clicking its ✕ drops that value from the URL and
 * re-navigates (which re-queries the page). Extracted from pageFilter.tsx; the
 * chip-building and removal logic are pure functions so they can be tested.
 */

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Chip } from "@heroui/chip";

type ChipColor = "primary" | "secondary" | "warning" | "default" | "success";

type FilterLookups = {
  aos?: { ao_org_id: number; ao_name: string }[];
  regions?: { region_org_id: number; region_name: string }[];
  types: { type_id: number; type_name: string }[];
  tags: { tag_id: number; tag_name: string }[];
};

type ActiveFilterChipsProps = FilterLookups & {
  /** Raw query-string (no leading `?`) for the current filters. */
  filters: string;
};

/**
 * A single active-filter chip. When `param` is set the chip is removable:
 * the ✕ drops `value` from the `param` id-list (or deletes a single-value
 * param when `value` is absent), removing `modeParam` when the list empties.
 */
export type ActiveChip = {
  label: string;
  color: ChipColor;
  param?: string;
  value?: string;
  modeParam?: string;
};

const ALL_HISTORY = "All History";

const CATEGORY_LOOKUP: ReadonlyArray<{ id: string; name: string }> = [
  { id: "1", name: "1st F" },
  { id: "2", name: "2nd F" },
  { id: "3", name: "3rd F" },
];

function parseIdList(value: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function findName<T>(
  list: T[] | undefined,
  id: string,
  idKey: keyof T,
  nameKey: keyof T,
): string | null {
  if (!list) return null;
  const n = Number(id);
  const found = list.find((item) => Number(item[idKey]) === n);
  return found ? String(found[nameKey]) : null;
}

/** Build the list of active-filter chips from a raw filter query-string. */
export function buildActiveChips(
  filters: string,
  { aos, regions, types, tags }: FilterLookups,
): ActiveChip[] {
  const sp = new URLSearchParams(filters ?? "");
  const out: ActiveChip[] = [];

  const range = sp.get("range");
  if (range && range !== ALL_HISTORY) {
    out.push({ label: range, color: "primary", param: "range" });
  }
  if (sp.get("startDate")) {
    out.push({
      label: `Start: ${sp.get("startDate")}`,
      color: "primary",
      param: "startDate",
    });
  }
  if (sp.get("endDate")) {
    out.push({
      label: `End: ${sp.get("endDate")}`,
      color: "primary",
      param: "endDate",
    });
  }

  const dimension = (
    idsParam: string,
    modeParam: string,
    color: ChipColor,
    labelFor: (id: string) => string | null,
    prefix = "",
  ) => {
    const ids = parseIdList(sp.get(idsParam));
    if (sp.get(modeParam) === "exclude" && ids.length > 0) {
      out.push({ label: "Exclude", color }); // indicator, not removable
    }
    for (const id of ids) {
      const name = labelFor(id);
      if (name) {
        out.push({
          label: `${prefix}${name}`,
          color,
          param: idsParam,
          value: id,
          modeParam,
        });
      }
    }
  };

  dimension(
    "regionIds",
    "regionMode",
    "secondary",
    (id) => findName(regions, id, "region_org_id", "region_name"),
    "F3 ",
  );
  dimension("aoIds", "aoMode", "secondary", (id) =>
    id === "0" ? "Unknown AO" : findName(aos, id, "ao_org_id", "ao_name"),
  );
  dimension("tagIds", "tagMode", "warning", (id) =>
    findName(tags, id, "tag_id", "tag_name"),
  );
  dimension("typeIds", "typeMode", "default", (id) =>
    findName(types, id, "type_id", "type_name"),
  );
  dimension(
    "categoryIds",
    "categoryMode",
    "success",
    (id) => CATEGORY_LOOKUP.find((c) => c.id === id)?.name ?? null,
  );

  return out;
}

/** Return the filter query-string with `chip` removed (no leading `?`). */
export function filtersAfterRemoval(filters: string, chip: ActiveChip): string {
  if (!chip.param) return filters;
  const sp = new URLSearchParams(filters ?? "");

  if (chip.value !== undefined) {
    const remaining = parseIdList(sp.get(chip.param)).filter(
      (id) => id !== chip.value,
    );
    if (remaining.length > 0) {
      sp.set(chip.param, remaining.join(","));
    } else {
      sp.delete(chip.param);
      if (chip.modeParam) sp.delete(chip.modeParam);
    }
  } else {
    sp.delete(chip.param);
  }

  return sp.toString();
}

export function ActiveFilterChips({
  aos,
  regions,
  types,
  tags,
  filters,
}: ActiveFilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const chips = useMemo(
    () => buildActiveChips(filters, { aos, regions, types, tags }),
    [filters, aos, regions, types, tags],
  );

  if (chips.length === 0) return null;

  const removeChip = (chip: ActiveChip) => {
    const qs = filtersAfterRemoval(filters, chip);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div id="filter-container" className="w-full max-w-6xl">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-card px-3 py-2">
        <span className="text-xs text-muted-foreground mr-1">
          Active Filters:
        </span>
        {chips.map((c, idx) => (
          <Chip
            key={`${c.label}-${idx}`}
            size="sm"
            color={c.color}
            variant="bordered"
            className="shrink-0"
            radius="sm"
            title={c.label}
            onClose={c.param ? () => removeChip(c) : undefined}
          >
            {c.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
