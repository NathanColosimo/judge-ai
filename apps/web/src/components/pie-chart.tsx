import { Label, Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type VerdictDistributionData = {
  verdict: "pass" | "fail" | "inconclusive";
  count: number;
  fill: string;
};

type VerdictDistributionChartProps = {
  data: VerdictDistributionData[];
  totalEvaluations: number;
};

// Chart configuration for verdict visualization with semantic colors
const chartConfig = {
  count: {
    label: "Evaluations",
  },
  pass: {
    label: "Pass",
    color: "hsl(142, 76%, 36%)", // Green
  },
  fail: {
    label: "Fail",
    color: "hsl(0, 84%, 60%)", // Red
  },
  inconclusive: {
    label: "Inconclusive",
    color: "hsl(215, 16%, 47%)", // Grey
  },
} satisfies ChartConfig;

/**
 * Donut chart displaying verdict distribution across all evaluations
 * Shows pass, fail, and inconclusive counts with total in center
 */
export function VerdictDistributionChart({
  data,
  totalEvaluations,
}: VerdictDistributionChartProps) {
  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="items-center pb-3">
        <CardTitle className="text-base">Verdict Distribution</CardTitle>
        <CardDescription className="text-xs">
          Pass, Fail, and Inconclusive
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {data.length === 0 || totalEvaluations === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            No verdict data available
          </p>
        ) : (
          <ChartContainer
            className="mx-auto aspect-square max-h-[200px]"
            config={chartConfig}
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent hideLabel />}
                cursor={false}
              />
              <Pie
                data={data}
                dataKey="count"
                innerRadius={50}
                nameKey="verdict"
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          dominantBaseline="middle"
                          textAnchor="middle"
                          x={viewBox.cx}
                          y={viewBox.cy}
                        >
                          <tspan
                            className="fill-foreground font-bold text-3xl"
                            x={viewBox.cx}
                            y={viewBox.cy}
                          >
                            {totalEvaluations.toLocaleString()}
                          </tspan>
                          <tspan
                            className="fill-muted-foreground"
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                          >
                            Evaluations
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
