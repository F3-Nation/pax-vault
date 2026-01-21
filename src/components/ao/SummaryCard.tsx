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
import { formatNumber } from "@/lib/utils";

type SummaryCardProps = {
  summary: AOSummary;
};

/**
 * Format a numeric summary value or return a safe fallback.
 */
function renderStat(value?: number, decimals?: number, suffix?: string) {
  if (typeof value !== "number") return "Unknown";
  const formatted = formatNumber(value, decimals);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

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
        <div className="flex justify-between py-1 pb-2">
          <span className="text-primary">Average PAX:</span>
          <span>{renderStat(summary.pax_count_average, 2, "PAX")}</span>
        </div>
      </CardBody>
    </Card>
  );
}
