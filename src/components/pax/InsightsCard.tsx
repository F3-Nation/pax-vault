"use client";

import { Card, CardHeader, CardBody } from "@heroui/card";
import { PaxInsights } from "@/types/pax";
import { Divider } from "@heroui/divider";
import { CustomBarChart as InsightsBarChart } from "@/components/charts/barChart";

export function InsightsCard({
  paxInsights,
}: {
  paxInsights: PaxInsights[];
}) {
  const paxData = paxInsights?.[0]?.paxData ?? [];

  const totalEvents = paxData.reduce((sum, entry, idx) => {
    const value = Number((entry as any)?.events ?? 0);
    // console.log("totalEvents step", {
    //   idx,
    //   month: entry.month,
    //   raw: (entry as any).events,
    //   type: typeof (entry as any).events,
    //   value,
    //   sumBefore: sum,
    //   sumAfter: sum + value,
    // });
    return sum + value;
  }, 0);

  // console.log("Pax Insights Data:", paxData);
  // console.log("Total events final:", totalEvents, "type:", typeof totalEvents);

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
              data={paxData.map(item => ({
                date: item.month,
                events: item.events,
                qs: item.qs,
              }))}
              dataKey="events"
              valueLabel="Post"
              color="var(--primary)"
              change={paxInsights[0].eventsChange}
            />
            <InsightsBarChart
              title="Monthly Q Volume"
              data={paxData.map(item => ({
                date: item.month,
                events: item.events,
                qs: item.qs,
              }))}
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