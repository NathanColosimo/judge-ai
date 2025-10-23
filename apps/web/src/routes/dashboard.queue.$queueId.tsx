import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [isRunning, setIsRunning] = useState(false);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!(session || isPending)) {
      navigate("/signin");
    }
  }, [session, isPending, navigate]);

  // Fetch unique questions for this queue
  const questionsQuery = useQuery({
    ...orpc.questions.getUniqueByQueue.queryOptions({
      input: { queueId: queueId as string },
    }),
    enabled: !!session && !!queueId,
  });

  // Fetch all questions (for counting submissions)
  const allQuestionsQuery = useQuery({
    ...orpc.questions.list.queryOptions({
      input: { queueId: queueId as string, limit: 1000, offset: 0 },
    }),
    enabled: !!session && !!queueId,
  });

  // Fetch assignments for this queue
  const assignmentsQuery = useQuery({
    ...orpc.assignments.getByQueue.queryOptions({
      input: { queueId: queueId as string },
    }),
    enabled: !!session && !!queueId,
  });

  // Fetch evaluations for this queue
  const evaluationsQuery = useQuery({
    ...orpc.evaluations.list.queryOptions({
      input: {
        ...(queueId ? { queueId } : {}),
        limit: 1000,
        offset: 0,
      },
    }),
    enabled: !!session && !!queueId,
  });

  // Fetch evaluation stats
  const statsQuery = useQuery({
    ...orpc.evaluations.stats.queryOptions({
      input: { queueId: queueId as string },
    }),
    enabled: !!session && !!queueId,
  });

  // Fetch all judges for assignment
  const judgesQuery = useQuery({
    ...orpc.judges.list.queryOptions({ input: {} }),
    enabled: !!session,
  });

  // Mutations
  const assignMutation = useMutation({
    mutationFn: (data: {
      queueId: string;
      questionId: string;
      judgeIds: string[];
    }) => orpc.assignments.assign.call(data),
    onSuccess: () => {
      toast.success("Judges assigned successfully");
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign judges: ${error.message}`);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (data: {
      queueId: string;
      questionId: string;
      judgeId: string;
    }) => orpc.assignments.unassignJudgeFromQuestion.call(data),
    onSuccess: () => {
      toast.success("Judge unassigned");
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(`Failed to unassign judge: ${error.message}`);
    },
  });

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

  // Get unique questions from API
  const questions =
    questionsQuery.data?.questions.map((q) => ({
      id: q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
    })) || [];

  // Determine queue status
  const hasAssignments = (assignmentsQuery.data?.assignments.length || 0) > 0;
  const hasEvaluations = (evaluationsQuery.data?.evaluations.length || 0) > 0;
  const queueStatus = determineQueueStatus(hasEvaluations, isRunning);

  // Handle assignment changes
  const handleToggleAssignment = (
    questionId: string,
    judgeId: string,
    isAssigned: boolean
  ) => {
    if (!queueId) {
      return;
    }

    if (isAssigned) {
      unassignMutation.mutate({ queueId, questionId, judgeId });
    } else {
      assignMutation.mutate({ queueId, questionId, judgeIds: [judgeId] });
    }
  };

  // Handle run evaluations
  const handleRunEvaluations = () => {
    if (!queueId) {
      return;
    }

    if (!hasAssignments) {
      toast.error("Please assign at least one judge to a question");
      return;
    }

    setIsRunning(true);
    runEvaluationsMutation.mutate({ queueId });
  };

  // Check if a judge is assigned to a question
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

  // Count unique submissions from questions
  const uniqueSubmissionIds = new Set(
    allQuestionsQuery.data?.questions.map((q) => q.submissionId) || []
  );
  const submissionCount = uniqueSubmissionIds.size;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <div className="flex flex-1 flex-col">
          <h1 className="font-semibold text-lg">Queue: {queueId}</h1>
          <p className="text-muted-foreground text-sm">
            {submissionCount} submissions · {questions.length} questions
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

      <div className="flex flex-1 flex-col gap-4 p-4">
        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Loading queue data...</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && queueStatus === "prep" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Assign Judges to Questions</CardTitle>
                <CardDescription>
                  Select which AI judges should evaluate each question in this
                  queue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AssignmentSection
                  isDisabled={
                    assignMutation.isPending || unassignMutation.isPending
                  }
                  isJudgeAssigned={isJudgeAssigned}
                  judges={judgesQuery.data?.judges || []}
                  onToggleAssignment={handleToggleAssignment}
                  questions={questions}
                />
              </CardContent>
            </Card>

            {hasAssignments && (
              <Card>
                <CardHeader>
                  <CardTitle>Ready to Run</CardTitle>
                  <CardDescription>
                    Preview: {submissionCount} submissions ×{" "}
                    {assignmentsQuery.data?.assignments.length || 0} judge
                    assignments ={" "}
                    {allQuestionsQuery.data?.questions.length || 0} total
                    evaluations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    disabled={
                      runEvaluationsMutation.isPending || !hasAssignments
                    }
                    onClick={handleRunEvaluations}
                    size="lg"
                  >
                    {runEvaluationsMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {!runEvaluationsMutation.isPending && (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Run Evaluations
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {queueStatus === "processing" && (
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
        )}

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
