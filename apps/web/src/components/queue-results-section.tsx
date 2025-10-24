import { useMemo } from "react";
import {
  EvaluationDataTable,
  type EvaluationItem,
} from "@/components/evaluation-data-table";
import { JudgePassRateChart } from "@/components/horizontal-chart";
import { VerdictDistributionChart } from "@/components/pie-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PERCENT_MULTIPLIER = 100;
const DECIMAL_PRECISION = 10;

export function ResultsSection({
  stats,
  evaluations,
}: {
  stats: {
    total: number;
    passRate: number;
    passCount: number;
    failCount: number;
  };
  evaluations: EvaluationItem[];
}) {
  // Calculate pass rate per judge for chart
  const judgePassRateData = useMemo(() => {
    const judgeStats = new Map<
      string,
      { passCount: number; totalCount: number }
    >();

    // Count pass/fail per judge
    for (const item of evaluations) {
      const judgeName = item.judge?.name || "Unknown";
      const current = judgeStats.get(judgeName) || {
        passCount: 0,
        totalCount: 0,
      };

      current.totalCount += 1;
      if (item.evaluation.verdict === "pass") {
        current.passCount += 1;
      }

      judgeStats.set(judgeName, current);
    }

    // Convert to chart format
    return Array.from(judgeStats.entries()).map(([judgeName, judgeData]) => ({
      judgeName,
      passRate:
        judgeData.totalCount > 0
          ? Math.round(
              (judgeData.passCount / judgeData.totalCount) *
                PERCENT_MULTIPLIER *
                DECIMAL_PRECISION
            ) / DECIMAL_PRECISION
          : 0,
      passCount: judgeData.passCount,
      totalCount: judgeData.totalCount,
    }));
  }, [evaluations]);

  // Calculate verdict distribution for pie chart
  const verdictDistributionData = useMemo(() => {
    const verdictCounts = {
      pass: 0,
      fail: 0,
      inconclusive: 0,
    };

    // Count each verdict type
    for (const item of evaluations) {
      const verdict = item.evaluation.verdict;
      if (verdict === "pass") {
        verdictCounts.pass += 1;
      } else if (verdict === "fail") {
        verdictCounts.fail += 1;
      } else {
        verdictCounts.inconclusive += 1;
      }
    }

    // Convert to chart format
    return [
      {
        verdict: "pass" as const,
        count: verdictCounts.pass,
        fill: "var(--color-pass)",
      },
      {
        verdict: "fail" as const,
        count: verdictCounts.fail,
        fill: "var(--color-fail)",
      },
      {
        verdict: "inconclusive" as const,
        count: verdictCounts.inconclusive,
        fill: "var(--color-inconclusive)",
      },
    ];
  }, [evaluations]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Results</CardTitle>
          <CardDescription>
            Pass rate and detailed evaluation results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Total Evaluations</p>
              <p className="font-bold text-2xl">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Pass Rate</p>
              <p className="font-bold text-2xl text-green-600">
                {stats.passRate}%
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Passed</p>
              <p className="font-bold text-2xl text-green-600">
                {stats.passCount}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Failed</p>
              <p className="font-bold text-2xl text-red-600">
                {stats.failCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section - Grid for multiple charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <JudgePassRateChart data={judgePassRateData} />
        <VerdictDistributionChart
          data={verdictDistributionData}
          totalEvaluations={stats.total}
        />
        {/* Additional chart can be added here */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation Details</CardTitle>
          <CardDescription>
            Click the arrow to expand and view full evaluation details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 && (
            <p className="text-muted-foreground">No evaluations found</p>
          )}

          {evaluations.length > 0 && (
            <EvaluationDataTable evaluations={evaluations} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
