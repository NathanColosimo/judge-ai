import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ListChecks } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
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
import { orpc } from "@/utils/orpc";

export default function Queues() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!(session || isPending)) {
      navigate("/signin");
    }
  }, [session, isPending, navigate]);

  // Fetch queues data (now from questions table, much more efficient!)
  const queuesQuery = useQuery({
    ...orpc.submissions.getQueues.queryOptions(),
    enabled: !!session,
  });

  const isLoading = queuesQuery.isLoading;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <div className="flex flex-col">
          <h1 className="font-semibold text-lg">Queues</h1>
          <p className="text-muted-foreground text-sm">
            View and manage evaluation queues
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Queues</CardTitle>
            <CardDescription>
              Assign judges to questions and run evaluations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <p className="text-muted-foreground">Loading queues...</p>
            )}

            {!isLoading &&
              queuesQuery.data &&
              queuesQuery.data.queues.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <ListChecks className="h-12 w-12 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">No queues found</p>
                    <p className="text-muted-foreground text-sm">
                      Upload submissions to create queues
                    </p>
                  </div>
                  <Button asChild={true}>
                    <Link to="/dashboard/submissions">Upload Submissions</Link>
                  </Button>
                </div>
              )}

            {!isLoading &&
              queuesQuery.data &&
              queuesQuery.data.queues.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Queue ID</TableHead>
                      <TableHead>Submissions</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queuesQuery.data.queues.map((queue) => (
                      <TableRow key={queue.queueId}>
                        <TableCell className="font-medium font-mono">
                          {queue.queueId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {queue.submissionCount}{" "}
                            {queue.submissionCount === 1
                              ? "submission"
                              : "submissions"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {queue.questionCount}{" "}
                            {queue.questionCount === 1
                              ? "question"
                              : "questions"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild={true} size="sm" variant="ghost">
                            <Link to={`/dashboard/queue/${queue.queueId}`}>
                              View
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
