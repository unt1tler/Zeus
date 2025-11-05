
"use client";

import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartContainer,
} from "@/components/ui/chart";
import type { DailyWebhookCreationsData } from "@/lib/types";

const chartConfig = {
  creations: { label: "Creations", color: "hsl(var(--chart-1))" },
};

export function WebhookCreationsChart({ data }: { data: DailyWebhookCreationsData[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-full w-full min-h-[120px]">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
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
          <ChartTooltip
            cursor={true}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelClassName="text-foreground"
                className="bg-background/90 backdrop-blur-sm"
              />
            }
          />
          <Bar dataKey="creations" fill="var(--color-creations)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
