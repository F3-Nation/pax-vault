"use client";

import { useEffect, useState } from "react";

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
import { formatNumber } from "@/lib/utils";
import { HelpIcon } from "@/components/icons";
import { Tooltip } from "@heroui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";

type SummaryCardProps = {
  summary: RegionSummary;
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
  // Tooltip hover isn't reliable on mobile; use Popover instead
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

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
            {isMobile ? (
              <Popover placement="bottom-start">
                <PopoverTrigger>
                  <span className="inline-flex cursor-pointer items-center">
                    <HelpIcon className="inline-block ml-1 text-default" />
                  </span>
                </PopoverTrigger>
                <PopoverContent className="max-w-[260px] p-2 text-sm">
                  Number of active PAX in the region over last 30 days
                </PopoverContent>
              </Popover>
            ) : (
              <Tooltip content="Number of active PAX in the region over last 30 days">
                <span className="inline-flex cursor-help items-center">
                  <HelpIcon className="inline-block ml-1 text-default" />
                </span>
              </Tooltip>
            )}
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
        <div className="flex justify-between py-1 pb-2 text-sm">
          <span className="text-primary">Average PAX:</span>
          <span>{renderStat(summary.pax_count_average, 2, "PAX")}</span>
        </div>
      </CardBody>
    </Card>
  );
}
