import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
  questions,
  judges,
  isJudgeAssigned,
  onToggleAssignment,
  isDisabled,
}: {
  questions: QuestionData[];
  judges: Judge[];
  isJudgeAssigned: (questionId: string, judgeId: string) => boolean;
  onToggleAssignment: (
    questionId: string,
    judgeId: string,
    isAssigned: boolean
  ) => void;
  isDisabled: boolean;
}) {
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
                      onToggleAssignment(question.id, judge.id, assigned)
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
