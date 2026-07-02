"use client";

/**
 * SummaryCard
 *
 * Displays high-level aggregate statistics for an AO
 * (workouts, AOs, PAX counts, Q counts, etc.).
 *
 * This component is purely presentational and assumes data has
 * already been validated and normalized upstream.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { AOSummary } from "@/lib/types";
import { renderStat } from "@/lib/utils";
// Fart Sack King / Ghost King hidden from public view for now — imports kept
// commented so the rows below can be restored without re-wiring.
// import { KingCell } from "@/components/KingCell";
// import { HelpHint } from "@/components/HelpHint";

type SummaryCardProps = {
  summary: AOSummary;
  filters?: string;
};

// `filters` stays in the props type (callers still pass it) but is unused while
// the Fart Sack King / Ghost King rows are hidden; re-add it to the destructure
// when restoring those rows.
export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">AO Summary</div>
      </CardHeader>
      <Divider />
      {/* Vertical stat list with consistent spacing and dividers */}
      <CardBody className="px-6">
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Total Workouts:</span>
          <span>{renderStat(summary.event_count, undefined, "Workouts")}</span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Active PAX:</span>
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
        {/* Fart Sack King / Ghost King hidden from public view for now.
            Calculations (summary.fartsack_kings / ghost_kings) still run upstream.
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary flex items-center">
            Fart Sack King:
            <HelpHint content="The PAX with the most fartsacks here — signed up for workouts but didn't show." />
          </span>
          <span>
            <KingCell leaders={summary.fartsack_kings} filters={filters} />
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary flex items-center">
            Ghost King:
            <HelpHint content="The PAX with the most ghost posts here — showed up to workouts unannounced, without signing up beforehand." />
          </span>
          <span>
            <KingCell leaders={summary.ghost_kings} filters={filters} />
          </span>
        </div>
        */}
        <div className="flex justify-between py-1 pb-2">
          <span className="text-primary">Average PAX:</span>
          <span>{renderStat(summary.pax_count_average, 2, "PAX")}</span>
        </div>
      </CardBody>
    </Card>
  );
}
