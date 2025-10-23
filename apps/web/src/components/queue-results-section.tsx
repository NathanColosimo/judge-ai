import { AlertCircle, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    tokensUsed: number | null;
    latencyMs: number | null;
    rawResponse: unknown;
  };
  question: {
    submissionId: string;
    questionId: string;
    questionText: string;
    questionType: string;
    answerChoice: string | null;
    answerReasoning: string | null;
  } | null;
  judge: { name: string; modelName: string } | null;
};

// Helper component for verdict badge
function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "pass") {
    return (
      <Badge className="bg-green-500" variant="default">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Pass
      </Badge>
    );
  }

  if (verdict === "fail") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Fail
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <AlertCircle className="mr-1 h-3 w-3" />
      Inconclusive
    </Badge>
  );
}

// Helper component for answer display
function AnswerDisplay({ question }: { question: EvaluationItem["question"] }) {
  const hasAnswer = question?.answerChoice || question?.answerReasoning;

  if (!hasAnswer) {
    return <p className="text-muted-foreground text-sm">No answer provided</p>;
  }

  return (
    <div className="space-y-2">
      {question?.answerChoice && (
        <div>
          <p className="text-muted-foreground text-xs">Choice</p>
          <p className="wrap-break-word text-sm">{question.answerChoice}</p>
        </div>
      )}
      {question?.answerReasoning && (
        <div>
          <p className="text-muted-foreground text-xs">Reasoning</p>
          <p className="wrap-break-word text-sm">{question.answerReasoning}</p>
        </div>
      )}
    </div>
  );
}

// Component for expanded details
function EvaluationDetails({ item }: { item: EvaluationItem }) {
  return (
    <div className="max-w-full space-y-4 overflow-hidden border-t bg-muted/50 p-6">
      {/* Question Section */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Question</h4>
        <div className="space-y-1 rounded-lg border bg-background p-4">
          <p className="text-muted-foreground text-xs">Type</p>
          <p className="wrap-break-word text-sm">
            {item.question?.questionType || "Unknown"}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">Text</p>
          <p className="wrap-break-word text-sm">
            {item.question?.questionText || "Unknown"}
          </p>
        </div>
      </div>

      {/* Answer Section */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">User's Answer</h4>
        <div className="space-y-2 rounded-lg border bg-background p-4">
          <AnswerDisplay question={item.question} />
        </div>
      </div>

      {/* Judge & Verdict Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h4 className="font-semibold text-sm">Judge Details</h4>
          <div className="space-y-2 rounded-lg border bg-background p-4">
            <div>
              <p className="text-muted-foreground text-xs">Name</p>
              <p className="wrap-break-word text-sm">
                {item.judge?.name || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Model</p>
              <p className="break-all font-mono text-xs">
                {item.judge?.modelName || "Unknown"}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <h4 className="font-semibold text-sm">Performance Metrics</h4>
          <div className="space-y-2 rounded-lg border bg-background p-4">
            <div>
              <p className="text-muted-foreground text-xs">Tokens Used</p>
              <p className="text-sm">{item.evaluation.tokensUsed || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Latency</p>
              <p className="text-sm">
                {item.evaluation.latencyMs
                  ? `${item.evaluation.latencyMs}ms`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Created At</p>
              <p className="text-sm">
                {new Date(item.evaluation.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Full Reasoning */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Full Reasoning</h4>
        <div className="rounded-lg border bg-background p-4">
          <p className="wrap-break-word text-sm leading-relaxed">
            {item.evaluation.reasoning}
          </p>
        </div>
      </div>
    </div>
  );
}

// Component for a single expandable evaluation row
function EvaluationRow({ item }: { item: EvaluationItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TableRow className="group">
        <TableCell>
          <Button
            className="h-8 w-8 p-0"
            onClick={() => setIsOpen(!isOpen)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </TableCell>
        <TableCell className="font-mono text-sm">
          {item.question?.submissionId.slice(0, SUBMISSIONS_TRUNCATE_LENGTH) ||
            "N/A"}
          ...
        </TableCell>
        <TableCell className="max-w-xs truncate">
          {item.question?.questionText || "Unknown"}
        </TableCell>
        <TableCell>{item.judge?.name || "Unknown"}</TableCell>
        <TableCell>
          <VerdictBadge verdict={item.evaluation.verdict} />
        </TableCell>
        <TableCell className="max-w-md">
          <p className="truncate text-sm">{item.evaluation.reasoning}</p>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell className="p-0" colSpan={6}>
            <EvaluationDetails item={item} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

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
            Click the arrow to expand and view full evaluation details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 && (
            <p className="text-muted-foreground">No evaluations found</p>
          )}

          {evaluations.length > 0 && (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead className="w-32">Submission</TableHead>
                    <TableHead className="w-48">Question</TableHead>
                    <TableHead className="w-32">Judge</TableHead>
                    <TableHead className="w-28">Verdict</TableHead>
                    <TableHead>Reasoning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((item) => (
                    <EvaluationRow item={item} key={item.evaluation.id} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
