"use client";

import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
  Line,
  ComposedChart,
} from "recharts";
import { TooltipProps } from "recharts";
import { formatDate } from "@/lib/utils";

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    let label_formatted = String(label);
    if (label.split("-").length === 3) {
      // M D Y label
      const date = new Date(label);
      label_formatted = formatDate(date, "M D Y");
    } else if (label.split("-").length === 2) {
      // M Y label
      const date = new Date(label);
      label_formatted = formatDate(date, "M Y");
    }
    return (
      <div className="p-2 rounded-md shadow-md bg-white/60 dark:bg-default-100/80 backdrop-blur-md text-xs">
        <p className="label">{label_formatted}</p>
        <p className="intro">
          {payload[0] ? `${payload[0].value} Unique PAX` : ""}
        </p>
        <p className="intro">
          {payload[1] ? `${payload[1].value} Average PAX` : ""}
        </p>
      </div>
    );
  }
  return null;
};

interface ComboBarLineChartProps {
  title: string;
  data: { iteration: string; count?: number; average?: number }[];
  bar_key: string;
  line_key: string;
  bar_color: string;
  line_color: string;
}

export function ComboBarLineChart({
  title,
  data,
  bar_key,
  line_key,
  bar_color,
  line_color,
}: ComboBarLineChartProps) {
  return (
    <div className="w-full h-72 flex flex-col">
      <h3 className="text-sm font-semibold text-center mb-1">{title}</h3>
      <div className="flex-1 ">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            syncId="barChartSync"
            margin={{
              top: 10,
              right: 0,
              left: -30,
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
            <XAxis dataKey="iteration" axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={bar_key} fill={bar_color} />
            <Line
              type="monotone"
              dataKey={line_key}
              stroke={line_color}
              strokeWidth={2}
              dot={false}
              strokeDasharray="3 4 5 2"
            />
            {/* <Brush height={20} fill="background" /> */}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
