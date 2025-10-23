import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SUBMISSIONS_TRUNCATE_LENGTH = 8;

type EvaluationItem = {
  evaluation: {
    id: string;
    questionId: string;
    verdict: string;
    reasoning: string;
    createdAt: Date;
  };
  question: {
    submissionId: string;
    questionId: string;
    questionText: string;
  } | null;
  judge: { name: string } | null;
};

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

      <Card>
        <CardHeader>
          <CardTitle>Evaluation Details</CardTitle>
          <CardDescription>
            Individual evaluation results with verdicts and reasoning
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 && (
            <p className="text-muted-foreground">No evaluations found</p>
          )}

          {evaluations.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Judge</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Reasoning</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((item) => (
                  <TableRow key={item.evaluation.id}>
                    <TableCell className="font-mono text-sm">
                      {item.question?.submissionId.slice(
                        0,
                        SUBMISSIONS_TRUNCATE_LENGTH
                      ) || "N/A"}
                      ...
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.question?.questionText || "Unknown"}
                    </TableCell>
                    <TableCell>{item.judge?.name || "Unknown"}</TableCell>
                    <TableCell>
                      {item.evaluation.verdict === "pass" && (
                        <Badge className="bg-green-500" variant="default">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Pass
                        </Badge>
                      )}
                      {item.evaluation.verdict === "fail" && (
                        <Badge variant="destructive">
                          <XCircle className="mr-1 h-3 w-3" />
                          Fail
                        </Badge>
                      )}
                      {item.evaluation.verdict === "inconclusive" && (
                        <Badge variant="secondary">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Inconclusive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate text-sm">
                        {item.evaluation.reasoning}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.evaluation.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
