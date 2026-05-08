"use client";

import { ChartData } from "@/lib/types";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type GrowthChartsCardProps = {
  charts: ChartData[];
};

function computeRollingAvg(data: ChartData[]): (number | null)[] {
  return data.map((_, i) => {
    const window = data.slice(Math.max(0, i - 3), i + 1);
    const sum = window.reduce((acc, d) => acc + d.unique_pax_count, 0);
    return Math.round((sum / window.length) * 10) / 10;
  });
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--heroui-content1))",
    border: "0.5px solid hsl(var(--heroui-default-200))",
    borderRadius: "8px",
    fontSize: "12px",
  },
  itemStyle: { color: "hsl(var(--heroui-foreground))" },
  labelStyle: { color: "hsl(var(--heroui-default-500))", marginBottom: 2 },
};

function UniquePaxChart({ charts }: { charts: ChartData[] }) {
  const rollingAvg = computeRollingAvg(charts);
  const enriched = charts.map((d, i) => ({ ...d, rolling_avg: rollingAvg[i] }));
  const hasData = charts.filter((d) => d.unique_pax_count > 0).length >= 2;

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Unique PAX Over Time</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart
              data={enriched}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="paxFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#378ADD" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.08)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value,
                  name === "unique_pax_count" ? "Unique PAX" : "4-wk Avg",
                ]}
                {...tooltipStyle}
              />
              <Area
                type="monotone"
                dataKey="unique_pax_count"
                stroke="#378ADD"
                strokeWidth={2}
                fill="url(#paxFill)"
                dot={{ r: 2.5, fill: "#378ADD", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="rolling_avg"
                stroke="#EF9F27"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex items-center justify-center text-xs text-default-400"
            style={{ height: 140 }}
          >
            Not enough data to show a trend yet.
          </div>
        )}
      </CardBody>
      <Divider />
      <CardFooter className="px-6 py-3">
        <p className="text-xs text-default-400">
          Tracks distinct PAX per period with a 4-week rolling average to smooth
          week-to-week noise and reveal the real growth trend.
        </p>
      </CardFooter>
    </Card>
  );
}

function FngAcquisitionChart({ charts }: { charts: ChartData[] }) {
  const hasData = charts.some((d) => d.fng_count > 0);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">FNG Acquisition</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={charts}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(128,128,128,0.08)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value: number) => [value, "FNGs"]}
                {...tooltipStyle}
              />
              <Bar
                dataKey="fng_count"
                fill="#1D9E75"
                radius={[3, 3, 0, 0]}
                activeBar={{ fill: "rgba(29,158,117,0.85)" }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex items-center justify-center text-xs text-default-400"
            style={{ height: 140 }}
          >
            No new members recorded in this period.
          </div>
        )}
      </CardBody>
      <Divider />
      <CardFooter className="px-6 py-3">
        <p className="text-xs text-default-400">
          Each bar is one period of first-time attendees. Spikes reveal which
          events or seasons drive new member growth.
        </p>
      </CardFooter>
    </Card>
  );
}

export function ChartCard({ charts }: GrowthChartsCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <UniquePaxChart charts={charts} />
      <FngAcquisitionChart charts={charts} />
    </div>
  );
}
