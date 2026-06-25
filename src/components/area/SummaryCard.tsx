"use client";

/**
 * AreaSummaryCard
 *
 * Displays high-level aggregate statistics for an Area
 * (workouts, regions, AOs, PAX counts, Q counts, etc.).
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { AreaSummary } from "@/lib/types";
import { renderStat } from "@/lib/utils";
import { HelpHint } from "@/components/HelpHint";

type AreaSummaryCardProps = {
  summary: AreaSummary;
};

export function AreaSummaryCard({ summary }: AreaSummaryCardProps) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Area Summary</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Total Events:</span>
          <span>{renderStat(summary.event_count, undefined, "Workouts")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Regions:</span>
          <span>{renderStat(summary.region_count, undefined, "Regions")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">AO Count:</span>
          <span>{renderStat(summary.ao_count, undefined, "AOs")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary flex items-center">
            Active PAX:
            <HelpHint content="Number of active PAX in the area over last 30 days" />
          </span>
          <span>{renderStat(summary.active_pax, undefined, "PAX")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Unique PAX:</span>
          <span>{renderStat(summary.unique_pax, undefined, "PAX")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Unique Qs:</span>
          <span>{renderStat(summary.unique_qs, undefined, "Qs")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">FNGs:</span>
          <span>{renderStat(summary.fng_count, undefined, "FNGs")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Fart Sack King:</span>
          <span>
            {summary.fartsack_king_count && summary.fartsack_king_user_id ? (
              <>
                <Link
                  className="text-sm"
                  color="secondary"
                  href={`/stats/pax/${summary.fartsack_king_user_id}`}
                >
                  {summary.fartsack_king_f3_name || "Unknown PAX"}
                </Link>
                {` (${renderStat(summary.fartsack_king_count)})`}
              </>
            ) : (
              "No PAX"
            )}
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2">
          <span className="text-primary">Average PAX:</span>
          <span>{renderStat(summary.pax_count_average, 2, "PAX")}</span>
        </div>
      </CardBody>
    </Card>
  );
}
