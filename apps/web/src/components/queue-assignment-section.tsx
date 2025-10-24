import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { orpc, queryClient } from "@/utils/orpc";

type QuestionData = {
  id: string;
  questionText: string;
  questionType: string;
};

type Judge = {
  id: string;
  name: string;
  isActive: boolean;
};

export function AssignmentSection({
  queueId,
  questions,
  judges,
  isJudgeAssigned,
}: {
  queueId: string;
  questions: QuestionData[];
  judges: Judge[];
  isJudgeAssigned: (questionId: string, judgeId: string) => boolean;
}) {
  // Local state for bulk-assign judge selection
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);

  // Mutations for assign/unassign/bulk-assign
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

  const bulkAssignMutation = useMutation({
    mutationFn: (data: {
      queueId: string;
      judgeId: string;
      questionIds: string[];
    }) => orpc.assignments.assignJudgeToQueue.call(data),
    onSuccess: (data) => {
      toast.success(
        `Assigned judge to ${data.count} question${data.count !== 1 ? "s" : ""}`
      );
      queryClient.invalidateQueries();
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk assign: ${error.message}`);
    },
  });

  const isDisabled = assignMutation.isPending || unassignMutation.isPending;

  const handleToggleAssignment = (
    questionId: string,
    judgeId: string,
    isAssigned: boolean
  ) => {
    if (isAssigned) {
      unassignMutation.mutate({ queueId, questionId, judgeId });
    } else {
      assignMutation.mutate({ queueId, questionId, judgeIds: [judgeId] });
    }
  };

  const handleBulkAssign = () => {
    if (!selectedJudgeId) {
      return;
    }
    const allQuestionIds = questions.map((q) => q.id);
    if (allQuestionIds.length === 0) {
      toast.error("No questions available to assign");
      return;
    }
    bulkAssignMutation.mutate({
      queueId,
      judgeId: selectedJudgeId,
      questionIds: allQuestionIds,
    });
  };

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground">No questions found in this queue</p>
    );
  }

  if (judges.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No judges available. Please create a judge first.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="space-y-6">
      {judges.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border p-4">
          <Label className="min-w-24 text-sm">Bulk assign</Label>
          <Select
            disabled={bulkAssignMutation.isPending}
            onValueChange={(value) => setSelectedJudgeId(value)}
            value={selectedJudgeId ?? undefined}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select judge" />
            </SelectTrigger>
            <SelectContent>
              {judges.map((j) => (
                <SelectItem disabled={!j.isActive} key={j.id} value={j.id}>
                  {j.name}
                  {j.isActive ? "" : " (inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={bulkAssignMutation.isPending || !selectedJudgeId}
            onClick={handleBulkAssign}
            type="button"
            variant="secondary"
          >
            {bulkAssignMutation.isPending
              ? "Assigning…"
              : "Assign to all questions"}
          </Button>
        </div>
      )}
      {questions.map((question) => (
        <div className="space-y-3 rounded-lg border p-4" key={question.id}>
          <div>
            <p className="font-medium">{question.questionText}</p>
            <p className="text-muted-foreground text-sm">
              Type: {question.questionType}
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm">Assign Judges:</Label>
            {judges.map((judge) => {
              const assigned = isJudgeAssigned(question.id, judge.id);
              return (
                <div className="flex items-center space-x-2" key={judge.id}>
                  <Checkbox
                    checked={assigned}
                    disabled={isDisabled}
                    id={`${question.id}-${judge.id}`}
                    onCheckedChange={() =>
                      handleToggleAssignment(question.id, judge.id, assigned)
                    }
                  />
                  <label
                    className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor={`${question.id}-${judge.id}`}
                  >
                    {judge.name}
                    {!judge.isActive && (
                      <Badge className="ml-2" variant="secondary">
                        Inactive
                      </Badge>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
