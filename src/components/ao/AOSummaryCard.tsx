"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { AOSummary } from "@/types/ao";

export function AOSummaryCard({
  summary,
}: {
  summary: AOSummary;
}) {
  return (
    (
      <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
          <CardHeader className="flex justify-between items-center px-6">
            <div className="font-semibold text-xl">AO Summary</div>
          </CardHeader>
          <Divider />
          <CardBody className="px-6">
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">First Workout:</span>
              <span>{summary?.first_start_time ?? "Unknown Start Date"}</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Total Workouts:</span>
              <span>{summary?.total_workouts ?? "Unknown"} Workouts</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Unique PAX:</span>
              <span>{summary?.unique_pax ?? "Unknown"} PAX</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Unique Qs:</span>
              <span>{summary?.unique_qs ?? "Unknown"} Qs</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">FNGs:</span>
              <span>{summary?.total_fngs ?? "Unknown"} FNGs</span>
            </div>
            <div className="flex justify-between py-1 pb-2 border-b light:border-black/10 dark:border-white/10">
              <span className="text-primary">Average PAX:</span>
              <span>{summary?.avg_pax_count ?? "Unknown"} PAX</span>
            </div>
            <div className="flex justify-between py-1 pb-2">
              <span className="text-primary">Peak PAX:</span>
              <span>{summary?.peak_pax_count ?? "Unknown"} PAX</span>
            </div>
          </CardBody>
        </Card>
    )
  );
}
