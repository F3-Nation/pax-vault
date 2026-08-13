"use client";

/**
 * ActivityMatrixCard
 *
 * AO x week heatmap of a PAX's posting activity over the last 52 weeks, laid
 * out like GitHub's contribution graph: one narrow column per week, with month
 * labels spanning the weeks that start in them.
 *
 * Cell shade is posts that week at that AO. Hovering a cell shows the exact
 * count. Rows are AOs ranked by volume, with the tail collapsed into "Other" —
 * the median PAX posts at 5 AOs but the tail runs past 80.
 *
 * The window is fixed and independent of the page's date filter: the columns
 * are the date axis.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { ActivityWindow, PaxAOWeeklyActivity } from "@/lib/types";
import {
  ACTIVITY_WEEKS,
  activityLevel,
  buildActivityMatrix,
  buildWeekKeys,
  buildWeekRange,
  weekLabel,
} from "@/lib/activityMatrix";
import { formatNumber } from "@/lib/utils";
import { useMemo, useState } from "react";

type ActivityMatrixCardProps = {
  activity: PaxAOWeeklyActivity[];
  /** Week span to render, resolved server-side from the active filters. */
  activityWindow: ActivityWindow | null;
  filters?: string;
};

/**
 * Colour ramp, index 0 = no activity.
 *
 * The ramp varies element opacity rather than using Tailwind alpha classes
 * (`bg-success/40`). This project's tailwind.config overrides HeroUI's
 * semantic colours with bare CSS variables (`success: { DEFAULT: "var(--success)" }`),
 * which carry no `<alpha-value>` placeholder — so `bg-success/40` generates no
 * rule at all and renders transparent. Opacity composites the same way and is
 * immune to that.
 */
const EMPTY_CLASS = "bg-default-200 dark:bg-default-100/60";
const LEVEL_OPACITY = [0, 0.35, 0.55, 0.78, 1] as const;

/** Class + style for a ramp level, so empty cells stay a neutral token. */
function levelStyle(level: number) {
  if (level <= 0) return { className: EMPTY_CLASS, style: undefined };
  return { className: "bg-success", style: { opacity: LEVEL_OPACITY[level] } };
}

type Tip = { text: string; x: number; y: number };

/** Hover text for an AO row label: the region, or what "Other" stands for. */
function rowTip(row: {
  isOther: boolean;
  otherAoCount: number;
  ao_name: string;
  region_name: string | null;
}): string {
  if (row.isOther) return `${row.otherAoCount} more AOs`;
  return row.region_name
    ? `${row.ao_name} · F3 ${row.region_name}`
    : row.ao_name;
}

export function ActivityMatrixCard({
  activity,
  activityWindow,
  filters,
}: ActivityMatrixCardProps) {
  // Columns come from the server-resolved window, so the axis always matches
  // the filters the data was queried with. The `new Date()` fallback only runs
  // if the window is somehow absent.
  const weeks = useMemo(
    () =>
      activityWindow
        ? buildWeekRange(activityWindow.start, activityWindow.end)
        : buildWeekKeys(new Date(), ACTIVITY_WEEKS),
    [activityWindow],
  );

  const matrix = useMemo(
    () => buildActivityMatrix(activity, weeks),
    [activity, weeks],
  );

  // One shared tooltip driven by hover, rather than 570+ tooltip components.
  const [tip, setTip] = useState<Tip | null>(null);

  const showTip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2, y: r.top });
  };
  const hideTip = () => setTip(null);

  const hasData = matrix.rows.length > 0;

  // Say "last 52 weeks" for the unfiltered default, and name the actual span
  // once a date filter narrows it, so the axis is never ambiguous.
  const rangeLabel =
    activityWindow && !activityWindow.isDefault
      ? `${weekLabel(matrix.weeks[0]).replace("week of ", "")} – ${weekLabel(
          matrix.weeks[matrix.weeks.length - 1],
        ).replace("week of ", "")}`
      : `last ${matrix.weeks.length} weeks`;

  // The label column is a FIXED width because the month header and each data
  // row are separate grid containers: a content-sized `minmax()` resolves
  // narrower against the header's empty first cell than against rows holding AO
  // names, which slid every month label 27px right of its own first week.
  //
  // Week columns are `minmax(floor, cap)`. The floor keeps them legible on
  // narrow screens; the cap stops a narrow date filter (say 14 weeks) from
  // stretching a handful of columns across the whole card, which with
  // aspect-square cells would balloon them into huge tiles. At 52 columns the
  // cap is never reached, so a full year still fills the card edge to edge.
  const gridTemplate = `11rem repeat(${matrix.weeks.length}, minmax(0.55rem, 1.4rem))`;

  // Scroll floor sized to the actual column count, so a narrow window doesn't
  // force horizontal scrolling for content that already fits.
  const minWidth = `calc(11rem + ${matrix.weeks.length} * (0.55rem + 2px) + 0.75rem)`;

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="font-semibold text-xl">Activity</div>
          <div className="text-sm text-default-500">
            {hasData
              ? `${formatNumber(matrix.total)} ${matrix.total === 1 ? "post" : "posts"} · `
              : ""}
            {rangeLabel}
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {!hasData ? (
          <div className="italic text-default-500 text-sm py-2">
            No posts in this range.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="w-full" style={{ minWidth }}>
                {/* Month header: each label spans the weeks starting in it. */}
                <div
                  className="grid gap-[2px] pb-1 pr-3"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div />
                  {matrix.monthSpans.map((m) => (
                    <div
                      key={m.key}
                      className="text-[10px] text-default-500 text-left overflow-hidden whitespace-nowrap"
                      style={{ gridColumn: `span ${m.span}` }}
                    >
                      {/* Very short runs would collide with the next label. */}
                      {m.span >= 2 ? m.label : ""}
                    </div>
                  ))}
                </div>

                <ScrollShadow className="max-h-[60vh] lg:max-h-[22rem]">
                  <div className="space-y-[2px] pr-3">
                    {matrix.rows.map((row) => (
                      <div
                        key={row.ao_org_id}
                        className="grid gap-[2px] items-center"
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        {/* One line per AO. The region lives in the hover
                            tooltip rather than a second line — it matters
                            mainly for disambiguating duplicate AO names across
                            regions, which is worth a hover but not a row that
                            is twice as tall. */}
                        <div
                          className="text-sm truncate pr-2 leading-none"
                          onMouseEnter={(e) => showTip(e, rowTip(row))}
                          onMouseLeave={hideTip}
                        >
                          {row.isOther ? (
                            <span className="italic text-default-500">
                              Other ({row.otherAoCount} AOs)
                            </span>
                          ) : (
                            <Link
                              className="text-sm truncate"
                              color="primary"
                              href={`/stats/ao/${row.ao_org_id}${filters ? `?${filters}` : ""}`}
                            >
                              {row.ao_name}
                            </Link>
                          )}
                        </div>

                        {row.counts.map((count, i) => {
                          const lvl = levelStyle(
                            activityLevel(count, matrix.thresholds),
                          );
                          const label = `${count} ${count === 1 ? "post" : "posts"} · ${weekLabel(matrix.weeks[i])} · ${row.ao_name}`;
                          return (
                            <div
                              key={matrix.weeks[i]}
                              className={`aspect-square rounded-[2px] ${lvl.className}`}
                              style={lvl.style}
                              aria-label={label}
                              onMouseEnter={(e) => showTip(e, label)}
                              onMouseLeave={hideTip}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </ScrollShadow>
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-end items-center gap-1 pt-3 text-[11px] text-default-500">
              <span className="pr-1">Less</span>
              {LEVEL_OPACITY.map((_, i) => {
                const lvl = levelStyle(i);
                return (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-[2px] ${lvl.className}`}
                    style={lvl.style}
                  />
                );
              })}
              <span className="pl-1">More</span>
            </div>

            {/* Single shared tooltip. `fixed` so the horizontally scrolling
                grid can't clip it. */}
            {tip && (
              <div
                role="tooltip"
                className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-default-800 px-2 py-1 text-xs text-default-50 shadow-lg whitespace-nowrap dark:bg-default-100 dark:text-foreground"
                style={{ left: tip.x, top: tip.y - 6 }}
              >
                {tip.text}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
