"use client";

import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
  BarChart,
} from "recharts";
import { TooltipProps } from "recharts";
import { formatChangeDescription } from "@/lib/utils";

const CustomTooltip = ({
  active,
  payload,
  label,
  valueLabel,
}: TooltipProps<number, string> & { valueLabel?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 rounded-md shadow-md bg-white/60 dark:bg-default-100/80 backdrop-blur-md text-xs">
        <p className="label">{label}</p>
        <p className="intro">
          {payload[0]
            ? `${payload[0].value} ${valueLabel ?? "Post"}${
                Number(payload[0].value) !== 1 ? "s" : ""
              }`
            : ""}
        </p>
      </div>
    );
  }
  return null;
};

interface BarChartProps {
  title: string;
  data: { date: string; events?: number; qs?: number }[];
  dataKey: string;
  valueLabel: string;
  color: string;
  change: number | null;
}

export function CustomBarChart({
  title,
  data,
  dataKey,
  valueLabel,
  color,
  change,
}: BarChartProps) {
  const maxEntry = data.reduce(
    (max, entry) =>
      entry[dataKey as keyof typeof entry] !== undefined &&
      (max === null ||
        (entry[dataKey as keyof typeof entry] as number) >
          (max[dataKey as keyof typeof entry] as number))
        ? entry
        : max,
    null as (typeof data)[0] | null,
  );

  const maxValue = maxEntry?.[dataKey as keyof typeof maxEntry] ?? 0;
  const maxDate = maxEntry?.date ?? null;

  return (
    <div className="w-full lg:w-1/2 h-72 flex flex-col">
      <h3 className="text-sm font-semibold text-center mb-1">{title}</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            syncId="barChartSync"
            margin={{
              top: 10,
              right: 0,
              left: -40,
              bottom: 0,
            }}
            className="text-xs"
          >
            <CartesianGrid
              stroke="#777"
              strokeDasharray="5 5"
              vertical={false}
            />
            <YAxis tick={true} axisLine={false} />
            <XAxis dataKey="date" axisLine={false} />
            <Tooltip content={<CustomTooltip valueLabel={valueLabel} />} />
            <Bar dataKey={dataKey} fill={color} name={valueLabel} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p
        className={`text-sm text-center ${
          change === null || change === 0
            ? "text-default-400"
            : change > 0
              ? "text-success"
              : "text-danger"
        }`}
      >
        {formatChangeDescription(change, valueLabel)}
      </p>
      {maxDate && (
        <p className="text-center text-sm">
          Peak {valueLabel}s in {maxDate} at {maxValue} {valueLabel}
          {maxValue !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
