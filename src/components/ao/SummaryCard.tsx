"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { AOSummary } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function SummaryCard({
  summary,
  title,
}: {
  summary: AOSummary;
  title: string;
}) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">{title} Summary</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Total Workouts:</span>
          <span>
            {summary?.event_count
              ? formatNumber(summary.event_count)
              : "Unknown"}{" "}
            Workouts
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">First Event Date:</span>
          <span>
            {summary?.first_event_date ? summary.first_event_date : "Unknown"}
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Active PAX:</span>
          <span>
            {summary?.active_pax ? formatNumber(summary.active_pax) : "Unknown"}{" "}
            PAX
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Unique PAX:</span>
          <span>
            {summary?.unique_pax ? formatNumber(summary.unique_pax) : "Unknown"}{" "}
            PAX
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">Unique Qs:</span>
          <span>
            {summary?.unique_qs ? formatNumber(summary.unique_qs) : "Unknown"}{" "}
            Qs
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
          <span className="text-primary">FNGs:</span>
          <span>
            {summary?.fng_count ? formatNumber(summary.fng_count) : "Unknown"}{" "}
            FNGs
          </span>
        </div>
        <div className="flex justify-between py-1 pb-2">
          <span className="text-primary">Average PAX:</span>
          <span>
            {summary?.pax_count_average
              ? formatNumber(summary.pax_count_average, 2)
              : "Unknown"}{" "}
            PAX
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
