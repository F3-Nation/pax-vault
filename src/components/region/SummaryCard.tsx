"use client";

/**
 * SummaryCard
 *
 * Displays high-level aggregate statistics for a region
 * (workouts, AOs, PAX counts, Q counts, etc.).
 *
 * This component is purely presentational and assumes data has
 * already been validated and normalized upstream.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { RegionSummary } from "@/lib/types";
import { renderStat } from "@/lib/utils";
import { HelpHint } from "@/components/HelpHint";
import { FartSackKing } from "@/components/FartSackKing";

type SummaryCardProps = {
  summary: RegionSummary;
  filters?: string;
};

export function SummaryCard({ summary, filters }: SummaryCardProps) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Region Summary</div>
      </CardHeader>
      <Divider />
      {/* Vertical stat list with consistent spacing and dividers */}
      <CardBody className="px-6">
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary">Total Events:</span>
          <span>{renderStat(summary.event_count, undefined, "Workouts")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary">AO Count:</span>
          <span>{renderStat(summary.ao_count, undefined, "AOs")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary flex items-center">
            Active PAX:
            <HelpHint content="Number of active PAX in the region over last 30 days" />
          </span>
          <span>{renderStat(summary.active_pax, undefined, "PAX")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary">Unique PAX:</span>
          <span>{renderStat(summary.unique_pax, undefined, "PAX")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary">Unique Qs:</span>
          <span>{renderStat(summary.unique_qs, undefined, "Qs")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary">FNGs:</span>
          <span>{renderStat(summary.fng_count, undefined, "FNGs")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10 text-sm">
          <span className="text-primary">Fart Sack King:</span>
          <span>
            <FartSackKing kings={summary.fartsack_kings} filters={filters} />
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 text-sm">
          <span className="text-primary">Average PAX:</span>
          <span>{renderStat(summary.pax_count_average, 2, "PAX")}</span>
        </div>
      </CardBody>
    </Card>
  );
}
