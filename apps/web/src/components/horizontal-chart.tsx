import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

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

// Constants for chart configuration
const DECIMAL_PLACES = 1;
const MAX_PASS_RATE = 100;

type JudgePassRateData = {
  judgeName: string;
  passRate: number;
  passCount: number;
  totalCount: number;
};

type JudgePassRateChartProps = {
  data: JudgePassRateData[];
};

// Chart configuration for pass rate visualization
const chartConfig = {
  passRate: {
    label: "Pass Rate",
    color: "hsl(var(--chart-2))",
  },
  label: {
    color: "hsl(var(--background))",
  },
} satisfies ChartConfig;

/**
 * Horizontal bar chart displaying pass rates by judge
 * Each bar shows the judge name on the left and pass rate percentage on the right
 */
export function JudgePassRateChart({ data }: JudgePassRateChartProps) {
  // Sort judges by pass rate in descending order
  const sortedData = [...data].sort((a, b) => b.passRate - a.passRate);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Judge Performance</CardTitle>
        <CardDescription className="text-xs">
          Pass rate by judge
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            No judge data available
          </p>
        ) : (
          <ChartContainer className="h-[200px] w-full" config={chartConfig}>
            <BarChart
              accessibilityLayer
              data={sortedData}
              layout="vertical"
              margin={{
                right: 24,
                left: 4,
                top: 4,
                bottom: 4,
              }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                axisLine={false}
                dataKey="judgeName"
                hide
                tickLine={false}
                tickMargin={10}
                type="category"
              />
              <XAxis
                dataKey="passRate"
                domain={[0, MAX_PASS_RATE]}
                hide
                type="number"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, props) => (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">
                          {props.payload.judgeName}
                        </span>
                        <span>
                          Pass Rate: {value}% ({props.payload.passCount}/
                          {props.payload.totalCount})
                        </span>
                      </div>
                    )}
                    indicator="line"
                  />
                }
                cursor={false}
              />
              <Bar
                dataKey="passRate"
                fill="var(--color-passRate)"
                layout="vertical"
                radius={4}
              >
                <LabelList
                  className="fill-[--color-label]"
                  dataKey="judgeName"
                  fontSize={12}
                  offset={8}
                  position="insideLeft"
                />
                <LabelList
                  className="fill-foreground"
                  dataKey="passRate"
                  fontSize={12}
                  formatter={(value: number) =>
                    `${value.toFixed(DECIMAL_PLACES)}%`
                  }
                  offset={8}
                  position="right"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
