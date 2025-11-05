
"use client";

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartTooltipContent,
  ChartContainer,
} from "@/components/ui/chart";
import type { DailyCommandUsage } from "@/lib/types";

const chartConfig = {
  commands: { label: "Commands", color: "hsl(var(--chart-1))" },
};

export function CommandUsageChart({ data }: { data: DailyCommandUsage[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-full w-full min-h-[250px]">
      <ResponsiveContainer>
        <LineChart
          accessibilityLayer
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 5,
          }}
        >
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            allowDecimals={false}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            cursor={true}
            content={
              <ChartTooltipContent
                indicator="line"
                labelClassName="text-foreground"
                className="bg-background/90 backdrop-blur-sm"
              />
            }
          />
          <Line
            dataKey="commands"
            type="monotone"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
