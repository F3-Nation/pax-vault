"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { PaxInsights } from "@/types/pax";
import { Divider } from "@heroui/divider";
import { CustomBarChart as InsightsBarChart } from "@/components/charts/barChart";
import { logger } from "@/lib/logger";

export function InsightsCard({ paxInsights }: { paxInsights: PaxInsights[] }) {
  const paxData = paxInsights?.[0]?.paxData ?? [];

  // Memoize totalEvents calculation to avoid recalculating on every render
  const totalEvents = useMemo(() => {
    return paxData.reduce((sum, entry, idx) => {
      const value = Number(entry.events ?? 0);
      logger.debug("totalEvents step: ", {
        idx,
        month: entry.month,
        raw: entry.events,
        type: typeof entry.events,
        value,
        sumBefore: sum,
        sumAfter: sum + value,
      });
      return sum + value;
    }, 0);
  }, [paxData]);

  // Memoize chart data mapping to avoid creating new arrays on every render
  const chartData = useMemo(() => {
    return paxData.map((item) => ({
      date: item.month,
      events: item.events,
      qs: item.qs,
    }));
  }, [paxData]);

  logger.debug("Pax Insights Data", paxData);
  logger.debug(
    `Total events final: ${totalEvents} type: ${typeof totalEvents}`
  );

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="text-center font-semibold text-xl px-6">
        PAX Insights
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {totalEvents > 10 ? (
          <div className="flex flex-col lg:flex-row gap-6">
            <InsightsBarChart
              title="Monthly Post Volume"
              data={chartData}
              dataKey="events"
              valueLabel="Post"
              color="var(--primary)"
              change={paxInsights[0].eventsChange}
            />
            <InsightsBarChart
              title="Monthly Q Volume"
              data={chartData}
              dataKey="qs"
              valueLabel="Q"
              color="var(--secondary)"
              change={paxInsights[0].qsChange}
            />
          </div>
        ) : (
          <p className="italic text-center text-sm text-default">
            Not enough data to calculate insights
          </p>
        )}
      </CardBody>
    </Card>
  );
}
