"use client";

/**
 * Charting Card
 *
 * Displays high-level aggregate charts for a region
 * (workouts, AOs, PAX counts, Q counts, etc.).
 *
 * This component is purely presentational and assumes data has
 * already been validated and normalized upstream.
 */

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { ChartData } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartCardProps = {
  charts: ChartData[];
};

const SimpleBarChart = (charts: ChartData[]) => {
  return (
    <ResponsiveContainer width="100%" aspect={1.618}>
      <BarChart data={charts} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
        <Tooltip />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="unique_pax_count"
          name="Unique PAX"
          fill="#8884d8"
          radius={[10, 10, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="unique_q_count"
          name="Unique Qs"
          fill="#82ca9d"
          radius={[10, 10, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export function ChartCard({ charts }: ChartCardProps) {
  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Region Charts</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {charts.length > 0 ? (
          SimpleBarChart(charts)
        ) : (
          <div className="text-center text-muted py-10">
            No chart data available for this region.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
