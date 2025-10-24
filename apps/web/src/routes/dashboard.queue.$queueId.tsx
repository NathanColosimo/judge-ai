import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { AssignmentSection } from "@/components/queue-assignment-section";
import { ResultsSection } from "@/components/queue-results-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

type QueueStatus = "prep" | "processing" | "done";

// Helper function to determine queue status
function determineQueueStatus(
  hasEvaluations: boolean,
  isRunning: boolean
): QueueStatus {
  if (hasEvaluations) {
    return "done";
  }
  if (isRunning) {
    return "processing";
  }
  return "prep";
}

// Helper function to check if judge is assigned to question
function checkJudgeAssignment(
  assignments: Array<{
    assignment: { questionId: string; judgeId: string };
  }>,
  questionId: string,
  judgeId: string
): boolean {
  return assignments.some(
    (a) =>
      a.assignment.questionId === questionId && a.assignment.judgeId === judgeId
  );
}

function QueueDetail() {
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!(session || isPending)) {
      navigate("/signin");
    }
  }, [session, isPending, navigate]);

  if (!queueId) {
    return null;
  }

  if (!(session || isPending)) {
    return null;
  }

  return <QueueDetailContent queueId={queueId} />;
}

function QueueDetailContent({ queueId }: { queueId: string }) {
  const [isRunning, setIsRunning] = useState(false);

  const questionsQuery = useQuery({
    ...orpc.questions.getUniqueByQueue.queryOptions({
      input: { queueId },
    }),
  });

  const allQuestionsQuery = useQuery({
    ...orpc.questions.list.queryOptions({
      input: { queueId, limit: 1000, offset: 0 },
    }),
  });

  const assignmentsQuery = useQuery({
    ...orpc.assignments.getByQueue.queryOptions({
      input: { queueId },
    }),
  });

  const hasAssignments = (assignmentsQuery.data?.assignments.length || 0) > 0;

  const evaluationsQuery = useQuery({
    ...orpc.evaluations.list.queryOptions({
      input: { queueId },
    }),
  });

  const hasEvaluations = (evaluationsQuery.data?.evaluations.length || 0) > 0;
  const statsQuery = useQuery({
    ...orpc.evaluations.stats.queryOptions({
      input: { queueId },
    }),
    enabled: hasEvaluations,
  });

  const judgesQuery = useQuery({
    ...orpc.judges.list.queryOptions({ input: {} }),
  });

  // Assignment mutations are managed inside AssignmentSection now

  const runEvaluationsMutation = useMutation({
    mutationFn: (data: { queueId: string }) => orpc.evaluations.run.call(data),
    onSuccess: (data) => {
      toast.success(
        `Evaluations complete: ${data.completed} completed, ${data.failed} failed`
      );
      queryClient.invalidateQueries();
      setIsRunning(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to run evaluations: ${error.message}`);
      setIsRunning(false);
    },
  });

  const questions =
    questionsQuery.data?.questions.map((q) => ({
      id: q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
    })) || [];

  const queueStatus = determineQueueStatus(hasEvaluations, isRunning);

  // Assignment handlers are managed inside AssignmentSection now

  const handleRunEvaluations = () => {
    if (!hasAssignments) {
      toast.error("Please assign at least one judge to a question");
      return;
    }
    setIsRunning(true);
    runEvaluationsMutation.mutate({ queueId });
  };

  const isJudgeAssigned = (questionId: string, judgeId: string): boolean =>
    checkJudgeAssignment(
      assignmentsQuery.data?.assignments || [],
      questionId,
      judgeId
    );

  const isLoading =
    questionsQuery.isLoading ||
    allQuestionsQuery.isLoading ||
    assignmentsQuery.isLoading ||
    judgesQuery.isLoading;

  const uniqueSubmissionIds = new Set(
    allQuestionsQuery.data?.questions.map((q) => q.submissionId) || []
  );
  const submissionCount = uniqueSubmissionIds.size;

  const plannedEvaluations = useMemo(() => {
    const allQuestions = allQuestionsQuery.data?.questions || [];
    const assignments = assignmentsQuery.data?.assignments || [];
    let total = 0;
    for (const a of assignments) {
      if (!a.judge) {
        continue;
      }
      const countForQuestionId = allQuestions.filter(
        (q) => q.questionId === a.assignment.questionId
      ).length;
      total += countForQuestionId;
    }
    return total;
  }, [allQuestionsQuery.data?.questions, assignmentsQuery.data?.assignments]);

  return (
    <>
      <QueueHeader
        questionCount={questions.length}
        queueId={queueId}
        queueStatus={queueStatus}
        submissionCount={submissionCount}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {isLoading && <LoadingCard />}

        {!isLoading && queueStatus === "prep" && (
          <PrepSection
            hasAssignments={hasAssignments}
            isJudgeAssigned={isJudgeAssigned}
            judges={judgesQuery.data?.judges.filter((j) => j.isActive) || []}
            onRun={handleRunEvaluations}
            plannedEvaluations={plannedEvaluations}
            questions={questions}
            queueId={queueId}
            runIsPending={runEvaluationsMutation.isPending}
          />
        )}

        {queueStatus === "processing" && <ProcessingSection />}

        {queueStatus === "done" && (
          <ResultsSection
            evaluations={evaluationsQuery.data?.evaluations || []}
            stats={{
              total: statsQuery.data?.total || 0,
              passRate: statsQuery.data?.passRate || 0,
              passCount: statsQuery.data?.passCount || 0,
              failCount: statsQuery.data?.failCount || 0,
            }}
          />
          
        )}
      </div>
    </>
  );
}

export default QueueDetail;

function QueueHeader({
  queueId,
  submissionCount,
  questionCount,
  queueStatus,
}: {
  queueId: string;
  submissionCount: number;
  questionCount: number;
  queueStatus: QueueStatus;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator className="mr-2 h-4" orientation="vertical" />
      <div className="flex flex-1 flex-col">
        <h1 className="font-semibold text-lg">Queue: {queueId}</h1>
        <p className="text-muted-foreground text-sm">
          {submissionCount} submissions · {questionCount} questions
        </p>
      </div>
      {queueStatus === "done" && (
        <Badge className="bg-green-500" variant="default">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      )}
      {queueStatus === "processing" && (
        <Badge className="bg-blue-500" variant="default">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Processing
        </Badge>
      )}
      {queueStatus === "prep" && <Badge variant="outline">Preparing</Badge>}
    </header>
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground">Loading queue data...</p>
      </CardContent>
    </Card>
  );
}

function PrepSection({
  queueId,
  questions,
  judges,
  isJudgeAssigned,
  hasAssignments,
  plannedEvaluations,
  onRun,
  runIsPending,
}: {
  queueId: string;
  questions: Array<{ id: string; questionText: string; questionType: string }>;
  judges: Array<{
    id: string;
    name: string;
    isActive: boolean;
    modelName: string;
  }>;
  isJudgeAssigned: (questionId: string, judgeId: string) => boolean;
  hasAssignments: boolean;
  plannedEvaluations: number;
  onRun: () => void;
  runIsPending: boolean;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Assign Judges to Questions</CardTitle>
          <CardDescription>
            Select which AI judges should evaluate each question in this queue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignmentSection
            isJudgeAssigned={isJudgeAssigned}
            judges={judges}
            questions={questions}
            queueId={queueId}
          />
        </CardContent>
      </Card>

      {hasAssignments && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Run</CardTitle>
            <CardDescription>
              Preview: {plannedEvaluations} total evaluations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              disabled={runIsPending || !hasAssignments}
              onClick={onRun}
              size="lg"
            >
              {runIsPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {!runIsPending && <Play className="mr-2 h-4 w-4" />}
              Run Evaluations
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ProcessingSection() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">Running Evaluations</p>
            <p className="text-muted-foreground text-sm">
              This may take a few moments...
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}