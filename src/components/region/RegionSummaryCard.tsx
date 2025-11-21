"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { RegionSummary } from "@/types/region";
import { formatNumber } from "@/lib/utils";

export function RegionSummaryCard({
  summary,
}: {
  summary: RegionSummary;
}) {
  return (
    (
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
            <div className="font-semibold text-xl">Region Summary</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Total Workouts:</span>
              <span>{summary?.event_count ? formatNumber(summary.event_count) : "Unknown"} Workouts</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">AO Count:</span>
              <span>{summary?.ao_count ? formatNumber(summary.ao_count) : "Unknown"} AOs</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Active PAX:</span>
              <span>{summary?.active_pax ? formatNumber(summary.active_pax) : "Unknown"} PAX</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Unique PAX:</span>
              <span>{summary?.unique_pax ? formatNumber(summary.unique_pax) : "Unknown"} PAX</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Unique Qs:</span>
              <span>{summary?.unique_qs ? formatNumber(summary.unique_qs) : "Unknown"} Qs</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">FNGs:</span>
              <span>{summary?.fng_count ? formatNumber(summary.fng_count) : "Unknown"} FNGs</span>
            </div>
            <div className="flex justify-between py-1 pb-2">
              <span className="text-primary">Average PAX:</span>
              <span>{summary?.pax_count_average ? formatNumber(summary.pax_count_average, 2) : "Unknown"} PAX</span>
            </div>
          </CardBody>
        </Card>
    )
  );
}
