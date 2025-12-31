"use client";

import { Treemap, ResponsiveContainer } from "recharts";

interface TreemapChartProps {
  data: { name: string; size: number }[];
}

function createColors(index: number): string {
  // Define a set of colors to choose from up to 30 items
  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff8042",
    "#8dd1e1",
    "#a4de6c",
    "#d0ed57",
    "#ffc0cb",
    "#b0e0e6",
    "#f4a460",
    "#dda0dd",
    "#90ee90",
    "#ffb6c1",
    "#20b2aa",
    "#87cefa",
    "#ff6347",
    "#40e0d0",
    "#ff69b4",
    "#ba55d3",
    "#7fffd4",
    "#f08080",
    "#e0ffff",
    "#ffdab9",
    "#afeeee",
    "#f5deb3",
    "#dda0dd",
    "#98fb98",
    "#ff4500",
    "#00ced1",
    "#ff1493",
  ];
  return colors[index % colors.length];
}

interface CustomizedContentProps {
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  name: string;
  size: number;
}

const CustomizedContent = (props: CustomizedContentProps) => {
  const { depth, x, y, width, height, index, name, size } = props;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? createColors(index) : "#ffffff00",
        }}
      />
      {depth === 1 ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + 7}
          textAnchor="middle"
          fill="#fff"
          fontSize={10}
        >
          {name}
        </text>
      ) : null}
      {depth === 1 ? (
        <text x={x + 4} y={y + 18} fill="#fff" fontSize={10} fillOpacity={0.9}>
          {size}
        </text>
      ) : null}
    </g>
  );
};

export function TreemapChart({ data }: TreemapChartProps) {
  return (
    <div className="w-full h-72 flex flex-col">
      <h3 className="text-sm font-semibold text-center mb-1">{"TITLE"}</h3>
      <div className="flex-1 ">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            stroke="var(--background)"
            content={
              <CustomizedContent
                depth={0}
                x={0}
                y={0}
                width={0}
                height={0}
                index={0}
                name={""}
                size={0}
              />
            }
          ></Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
