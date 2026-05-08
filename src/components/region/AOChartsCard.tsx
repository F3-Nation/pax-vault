"use client";

import { AOHeatmapData, AOPaxTrendData, AOQDepthData } from "@/lib/types";
import { Fragment, useState } from "react";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Button } from "@heroui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LINE_COLORS = [
  "#378ADD",
  "#1D9E75",
  "#EF9F27",
  "#D85A30",
  "#7F77DD",
  "#E24B4A",
];

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

// ─── Heatmap ────────────────────────────────────────────────────────────────

export function HeatmapChart({ data }: { data: AOHeatmapData[] }) {
  const aoNames = [...new Set(data.map((d) => d.ao_name))].sort();
  const allValues = data.map((d) => d.avg_pax);
  const maxVal = Math.max(...allValues, 1);

  const cellMap = new Map<string, AOHeatmapData>();
  data.forEach((d) => cellMap.set(`${d.ao_name}|${d.day_of_week}`, d));

  const hasData = data.length > 0;

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Day-of-Week Attendance</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6 overflow-x-auto">
        {hasData ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px repeat(6, 1fr)",
              gap: 3,
              minWidth: 320,
            }}
          >
            {/* Header row */}
            <div />
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center font-mono text-default-400"
                style={{ fontSize: 10 }}
              >
                {day}
              </div>
            ))}
            {/* Data rows */}
            {aoNames.map((ao) => (
              <Fragment key={ao}>
                <div
                  className="text-default-400 truncate pr-1"
                  style={{ fontSize: 10, lineHeight: "26px" }}
                  title={ao}
                >
                  {ao}
                </div>
                {DAYS.map((day) => {
                  const cell = cellMap.get(`${ao}|${day}`);
                  if (!cell) {
                    return (
                      <div
                        key={`${ao}-${day}`}
                        style={{
                          height: 26,
                          borderRadius: 4,
                          background: "rgba(128,128,128,0.06)",
                        }}
                      />
                    );
                  }
                  const alpha = 0.15 + (cell.avg_pax / maxVal) * 0.75;
                  const textColor = alpha > 0.6 ? "#fff" : undefined;
                  return (
                    <div
                      key={`${ao}-${day}`}
                      title={`${ao} · ${day}: ${cell.avg_pax} avg PAX (${cell.workout_count} workouts)`}
                      style={{
                        height: 26,
                        borderRadius: 4,
                        background: `rgba(55,138,221,${alpha.toFixed(2)})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontFamily: "monospace",
                        color: textColor,
                        cursor: "default",
                        transition: "transform 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.transform =
                          "scale(1.08)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.transform =
                          "scale(1)")
                      }
                    >
                      {cell.avg_pax}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center text-xs text-default-400 py-10">
            No workout data available for this period.
          </div>
        )}
      </CardBody>
      <Divider />
      <CardFooter className="px-6 py-3">
        <p className="text-xs text-default-400">
          Average PAX per AO per day of week, trailing 90 days. Darker cells
          mean higher average attendance.
        </p>
      </CardFooter>
    </Card>
  );
}

// ─── Q Depth ────────────────────────────────────────────────────────────────

function qDepthColor(pct: number) {
  if (pct >= 70) return "#1D9E75";
  if (pct >= 50) return "#EF9F27";
  return "#E24B4A";
}

export function QDepthChart({ data }: { data: AOQDepthData[] }) {
  const hasData = data.length > 0;
  const chartHeight = Math.max(160, data.length * 28);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Q Depth per AO</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {hasData ? (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="rgba(128,128,128,0.08)"
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="ao_name"
                  width={80}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ReferenceLine
                  x={70}
                  stroke="rgba(128,128,128,0.3)"
                  strokeDasharray="3 3"
                />
                <Tooltip
                  formatter={(_v, _n, props) => {
                    const d = props.payload as AOQDepthData;
                    return [
                      `${d.q_depth_pct}% (${d.unique_qs} Qs / ${d.total_workouts} workouts)`,
                      "Q Depth",
                    ];
                  }}
                  {...tooltipStyle}
                />
                <Bar
                  dataKey="q_depth_pct"
                  barSize={12}
                  radius={[0, 3, 3, 0]}
                  fill="#1D9E75"
                  shape={(props: unknown) => {
                    const { x, y, width, height, value } = props as {
                      x: number;
                      y: number;
                      width: number;
                      height: number;
                      value: number;
                    };
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={3}
                        fill={qDepthColor(value)}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
            {/* Static legend */}
            <div className="flex gap-4 mt-2 flex-wrap">
              {[
                { color: "#1D9E75", label: "Healthy (70%+)" },
                { color: "#EF9F27", label: "Watch (50–69%)" },
                { color: "#E24B4A", label: "At risk (<50%)" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div
                    className="rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="font-mono text-default-400"
                    style={{ fontSize: 10 }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center text-xs text-default-400 py-10">
            No Q data available for this period.
          </div>
        )}
      </CardBody>
      <Divider />
      <CardFooter className="px-6 py-3">
        <p className="text-xs text-default-400">
          Ratio of unique Qs to total workouts per AO, trailing 90 days. Low
          depth means a site runs on one or two people — a key-man risk.
        </p>
      </CardFooter>
    </Card>
  );
}

// ─── Unique Qs per AO ───────────────────────────────────────────────────────

export function UniqueQsPerAOChart({ data }: { data: AOQDepthData[] }) {
  const hasData = data.length > 0;
  const chartHeight = Math.max(160, data.length * 28);
  const sorted = [...data].sort((a, b) => b.unique_qs - a.unique_qs);

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Unique Qs per AO</div>
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="rgba(128,128,128,0.08)"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="ao_name"
                width={80}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(_v, _n, props) => {
                  const d = props.payload as AOQDepthData;
                  return [`${d.unique_qs} unique Qs`, "Unique Qs"];
                }}
                {...tooltipStyle}
              />
              <Bar
                dataKey="unique_qs"
                barSize={12}
                radius={[0, 3, 3, 0]}
                fill="#7C3AED"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center text-xs text-default-400 py-10">
            No Q data available for this period.
          </div>
        )}
      </CardBody>
      <Divider />
      <CardFooter className="px-6 py-3">
        <p className="text-xs text-default-400">
          Number of distinct leaders who have Q&apos;d at each AO, trailing 90
          days. Shows how many people can run each site.
        </p>
      </CardFooter>
    </Card>
  );
}

// ─── Avg PAX Trend ──────────────────────────────────────────────────────────

export function AvgPaxTrendChart({ data }: { data: AOPaxTrendData[] }) {
  const [selectedAO, setSelectedAO] = useState<string | null>(null);

  const periods = [...new Set(data.map((d) => d.period))].sort((a, b) => {
    return new Date(`1 ${a}`).getTime() - new Date(`1 ${b}`).getTime();
  });

  const allAONames = [...new Set(data.map((d) => d.ao_name))].filter((ao) => {
    return data.filter((d) => d.ao_name === ao).length >= 3;
  });

  // Top 5 by mean avg_pax across all periods
  const top5 = [...allAONames]
    .map((ao) => {
      const rows = data.filter((d) => d.ao_name === ao);
      const mean = rows.reduce((s, d) => s + d.avg_pax, 0) / rows.length;
      return { ao, mean };
    })
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 5)
    .map((x) => x.ao);

  // Region average per period (average of all AOs)
  const regionAvgByPeriod = new Map<string, number>();
  periods.forEach((p) => {
    const rows = data.filter((d) => d.period === p);
    if (rows.length) {
      const avg =
        Math.round(
          (rows.reduce((s, d) => s + d.avg_pax, 0) / rows.length) * 10,
        ) / 10;
      regionAvgByPeriod.set(p, avg);
    }
  });

  const activeAOs = selectedAO ? [selectedAO] : top5;

  const pivoted = periods.map((period) => {
    const row: Record<string, string | number> = { period };
    if (selectedAO) {
      const match = data.find(
        (d) => d.ao_name === selectedAO && d.period === period,
      );
      if (match) row[selectedAO] = match.avg_pax;
      const regionAvg = regionAvgByPeriod.get(period);
      if (regionAvg !== undefined) row["Region Avg"] = regionAvg;
    } else {
      data
        .filter((d) => d.period === period && top5.includes(d.ao_name))
        .forEach((d) => {
          row[d.ao_name] = d.avg_pax;
        });
    }
    return row;
  });

  const hasData = allAONames.length > 0 && periods.length >= 2;

  return (
    <Card className="bg-background/60 dark:bg-default-100/50" shadow="md">
      <CardHeader className="flex justify-between items-center px-6 lg:min-h-16">
        <div className="font-semibold text-xl">Avg PAX Trend per AO</div>
        {hasData && (
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="bordered" color="default">
                {selectedAO ?? "Top 5 AOs"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Select AO"
              selectionMode="single"
              selectedKeys={new Set([selectedAO ?? "__top5__"])}
              onSelectionChange={(keys) => {
                const k = Array.from(keys as Set<string>)[0];
                setSelectedAO(k === "__top5__" ? null : k);
              }}
              items={[
                { key: "__top5__", label: "Top 5 AOs" },
                ...allAONames.map((ao) => ({ key: ao, label: ao })),
              ]}
            >
              {(item) => (
                <DropdownItem key={item.key}>{item.label}</DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        )}
      </CardHeader>
      <Divider />
      <CardBody className="px-6">
        {hasData ? (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart
                data={pivoted}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(128,128,128,0.08)"
                />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  label={{
                    value: "Avg PAX",
                    angle: -90,
                    position: "insideLeft",
                    style: {
                      fontSize: 9,
                      fill: "hsl(var(--heroui-default-400))",
                    },
                  }}
                />
                <Tooltip {...tooltipStyle} />
                {selectedAO
                  ? [
                      <Line
                        key={selectedAO}
                        type="monotone"
                        dataKey={selectedAO}
                        stroke="#378ADD"
                        strokeWidth={2}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />,
                      <Line
                        key="Region Avg"
                        type="monotone"
                        dataKey="Region Avg"
                        stroke="rgba(128,128,128,0.5)"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 2 }}
                        activeDot={{ r: 3.5 }}
                        connectNulls
                      />,
                    ]
                  : activeAOs.map((ao, i) => (
                      <Line
                        key={ao}
                        type="monotone"
                        dataKey={ao}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={1.5}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
              </LineChart>
            </ResponsiveContainer>
            {!selectedAO && (
              <div className="flex gap-4 mt-2 flex-wrap">
                {activeAOs.map((ao, i) => (
                  <div key={ao} className="flex items-center gap-1">
                    <div
                      className="rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        background: LINE_COLORS[i % LINE_COLORS.length],
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="font-mono text-default-400 truncate"
                      style={{ fontSize: 10 }}
                    >
                      {ao}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center text-xs text-default-400 py-10">
            Not enough history to show a trend yet.
          </div>
        )}
      </CardBody>
      <Divider />
      <CardFooter className="px-6 py-3">
        <p className="text-xs text-default-400">
          {selectedAO
            ? `${selectedAO} vs. the average of all active AOs, last 6 months.`
            : "Top 5 AOs by average attendance, last 6 months. Select an AO from the dropdown to compare it against the region average."}
        </p>
      </CardFooter>
    </Card>
  );
}
