
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
import type { DailyValidationData } from "@/lib/types";

const chartConfig = {
  success: { label: "Success", color: "hsl(var(--chart-2))" },
  failure: { label: "Failure", color: "hsl(var(--chart-1))" },
};

export function ValidationChart({ data }: { data: DailyValidationData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[250px] w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No data available.</p>
      </div>
    );
  }

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
            dataKey="success"
            type="monotone"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={true}
          />
          <Line
            dataKey="failure"
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

    