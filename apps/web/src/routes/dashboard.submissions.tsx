import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/kibo-ui/dropzone";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

// Validation schema matching backend
const questionSchema = z.object({
  rev: z.number(),
  data: z.object({
    id: z.string(),
    questionType: z.string(),
    questionText: z.string(),
  }),
});

const answerSchema = z.object({
  choice: z.string().optional(),
  reasoning: z.string().optional(),
});

const submissionSchema = z.object({
  id: z.string(),
  queueId: z.string(),
  labelingTaskId: z.string().optional(),
  createdAt: z.number(),
  questions: z.array(questionSchema),
  answers: z.record(z.string(), answerSchema),
});

const submissionsArraySchema = z.array(submissionSchema);

export default function Submissions() {
  const { data: session } = authClient.useSession();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File[] | undefined>();

  // Fetch submissions grouped by queue
  const queuesQuery = useQuery({
    ...orpc.submissions.getQueues.queryOptions(),
    enabled: !!session,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (submissions: z.infer<typeof submissionsArraySchema>) =>
      orpc.submissions.upload.call(submissions),
    onSuccess: () => {
      toast.success("Submissions uploaded successfully");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.submissions.delete.call({ id }),
    onSuccess: () => {
      toast.success("Submission deleted");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  // Handle upload errors
  const handleUploadError = (error: unknown) => {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((issue) => issue.message)
        .join(", ");
      setValidationError(`Invalid JSON structure: ${errorMessages}`);
      return;
    }

    if (error instanceof SyntaxError) {
      setValidationError("Invalid JSON file");
      return;
    }

    setValidationError(
      error instanceof Error ? error.message : "Upload failed"
    );
  };

  // Handle file drop
  const handleDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) {
      return;
    }

    setSelectedFile([file]);
    setIsUploading(true);
    setValidationError(null);

    try {
      // Read file as text
      const text = await file.text();
      const json = JSON.parse(text);

      // Validate against schema
      const validated = submissionsArraySchema.parse(json);

      // Upload to backend
      await uploadMutation.mutateAsync(validated);

      // Clear selected file on success
      setSelectedFile(undefined);
    } catch (error) {
      handleUploadError(error);
    } finally {
      setIsUploading(false);
    }
  };

  const hasQueues = (queuesQuery.data?.queues.length ?? 0) > 0;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <div className="flex flex-col">
          <h1 className="font-semibold text-lg">Submissions</h1>
          <p className="text-muted-foreground text-sm">
            Upload and manage submission data
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* File Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Submissions</CardTitle>
            <CardDescription>
              Upload JSON files containing questions and answers for evaluation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dropzone
              accept={{ "application/json": [".json"] }}
              disabled={isUploading}
              maxFiles={1}
              onDrop={handleDrop}
              onError={(error) => setValidationError(error.message)}
              src={selectedFile}
            >
              <DropzoneEmptyState />
              <DropzoneContent />
              {isUploading && (
                <p className="mt-2 text-muted-foreground text-sm">
                  Uploading...
                </p>
              )}
            </Dropzone>

            {validationError && (
              <Alert className="mt-4" variant="destructive">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Submissions List by Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Submissions by Queue</CardTitle>
            <CardDescription>
              View and manage uploaded submissions grouped by queue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queuesQuery.isLoading && (
              <p className="text-muted-foreground text-sm">Loading...</p>
            )}
            {!queuesQuery.isLoading && hasQueues && (
              <div className="space-y-6">
                {queuesQuery.data?.queues.map((queue) => (
                  <div className="space-y-2" key={queue.queueId}>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4" />
                      <h3 className="font-semibold">{queue.queueId}</h3>
                      <Badge variant="secondary">
                        {queue.submissionCount} submission
                        {queue.submissionCount !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline">
                        {queue.questionCount} question
                        {queue.questionCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <SubmissionsTable
                      onDelete={(id) => deleteMutation.mutate(id)}
                      queueId={queue.queueId}
                    />
                  </div>
                ))}
              </div>
            )}
            {!(queuesQuery.isLoading || hasQueues) && (
              <p className="text-muted-foreground text-sm">
                No submissions yet. Upload a JSON file to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Separate component for submissions table per queue
function SubmissionsTable({
  queueId,
  onDelete,
}: {
  queueId: string;
  onDelete: (id: string) => void;
}) {
  const { data: session } = authClient.useSession();

  const submissionsQuery = useQuery({
    ...orpc.submissions.list.queryOptions({
      input: { queueId, limit: 50, offset: 0 },
    }),
    enabled: !!session,
  });

  if (submissionsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }

  if (!submissionsQuery.data?.submissions.length) {
    return null;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Submission ID</TableHead>
          <TableHead>Questions</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissionsQuery.data.submissions.map((submission) => (
          <TableRow key={submission.id}>
            <TableCell className="font-mono text-sm">{submission.id}</TableCell>
            <TableCell>{submission.questionCount}</TableCell>
            <TableCell>
              {new Date(submission.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Button
                onClick={() => onDelete(submission.id)}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
