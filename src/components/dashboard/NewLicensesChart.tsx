
"use client";

import { Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { NewLicenseDistributionData } from "@/lib/types";

const chartConfig = {
  value: { label: "Licenses" },
  new: { label: "New Customers", color: "hsl(var(--chart-1))" },
  existing: { label: "Existing Customers", color: "hsl(var(--chart-2))" },
};

export function NewLicensesChart({ data }: { data: NewLicenseDistributionData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[120px] w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No data available.</p>
      </div>
    );
  }
  
  return (
    <ChartContainer config={chartConfig} className="h-full w-full min-h-[120px]">
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={40}
            strokeWidth={5}
          />
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

    