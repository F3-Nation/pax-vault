"use client";

/**
 * AOBreakdownCard
 *
 * Lists every AO in the region with its beatdown (workout) count, ordered by
 * count. Sits beside the Upcoming Events card in the region dashboard's
 * two-column row, and follows the same card shape as its neighbours
 * (UpcomingEventsCard / AchievementsCard / KotterCard): a ScrollShadow-capped
 * list of flex rows, not a table.
 *
 * Counts come from the same filtered event set as the rest of the page, so
 * they move with the active filters. AOs with no workouts in the current
 * filter window simply don't appear.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Link } from "@heroui/link";
import { RegionAOBreakdown } from "@/lib/types";
import { renderStat } from "@/lib/utils";

type AOBreakdownCardProps = {
  aos: RegionAOBreakdown[];
  /** Active filter query-string, forwarded so AO links keep the same view. */
  filters?: string;
};

export function AOBreakdownCard({ aos, filters }: AOBreakdownCardProps) {
  const totalBeatdowns = aos.reduce((sum, ao) => sum + (ao.beatdowns ?? 0), 0);
  // Exclude the ao_id 0 "(No AO)" sentinel row so this count matches the
  // AO Count stat on the summary card.
  const aoCount = aos.filter((ao) => ao.ao_id).length;

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      {/* lg:min-h-16 matches the SummaryCard / pax AOBreakdownCard convention
          for headers with no button or tabs to give them height. */}
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="font-semibold text-xl">AO Breakdown</div>
          <div className="text-sm text-default-500">
            {aoCount} {aoCount === 1 ? "AO" : "AOs"}
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <ScrollShadow className="max-h-[60vh] lg:max-h-[32rem]">
          {/* pr-3 keeps the beatdown counts off the scrollbar. */}
          <div className="space-y-1 text-sm pr-3">
            {aos.length === 0 ? (
              <div className="italic text-default-500 text-sm py-2">
                No AO data available.
              </div>
            ) : (
              <>
                {aos.map((ao, idx) => (
                  <div
                    key={`${ao.ao_id}-${idx}`}
                    className="flex justify-between items-center py-1 pb-2 border-b light:border-black/10 dark:border-white/10"
                  >
                    {/* ao_id 0 is the "no AO" sentinel — region-level workouts
                        with no AO assigned. There's no page to link to. */}
                    {ao.ao_id ? (
                      <Link
                        className="text-sm"
                        color="primary"
                        href={`/stats/ao/${ao.ao_id}${filters ? `?${filters}` : ""}`}
                      >
                        {ao.ao_name}
                      </Link>
                    ) : (
                      <span className="text-sm italic text-default-500">
                        {ao.ao_name}
                      </span>
                    )}
                    <span className="flex-shrink-0 ml-3">
                      {renderStat(ao.beatdowns, undefined, "Beatdowns")}
                    </span>
                  </div>
                ))}
                {/* Total reconciles with the Total Events stat on the summary
                    card, which is why the "(No AO)" row above is included. */}
                <div className="flex justify-between items-center py-1 pb-2 font-semibold">
                  <span className="text-primary">Total</span>
                  <span className="flex-shrink-0 ml-3">
                    {renderStat(totalBeatdowns, undefined, "Beatdowns")}
                  </span>
                </div>
              </>
            )}
          </div>
        </ScrollShadow>
      </CardBody>
    </Card>
  );
}
