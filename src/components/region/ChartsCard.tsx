"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { RegionChartData } from "@/types/region";
import { ComboBarLineChart } from "../charts/comboChart";
// import { TreemapChart } from "../charts/treeChart";

export function ChartsCard({
  chartData,
}: {
  chartData: RegionChartData | null;
}) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Region Insights</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {chartData?.uniquePax?.data && chartData.uniquePax.data.length > 0 ? (
          <ComboBarLineChart
            title="Unique Pax Over Time"
            data={chartData.uniquePax.data.map((item) => ({
              iteration: item.iteration,
              count: item.count,
              average: item.average,
            }))}
            bar_key="count"
            line_key="average"
            bar_color="var(--primary)"
            line_color="var(--warning)"
          />
        ) : (
          <div className="text-center py-6 text-foreground/70 italic">
            No data available
          </div>
        )}
        {/* <TreemapChart
          data={
            chartData?.workoutAOCount.map((item) => ({
              name: item.aoName,
              size: item.count,
            })) ?? []
          }
        /> */}
      </CardBody>
    </Card>
  );
}
