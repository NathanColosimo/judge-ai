import { useQuery } from "@tanstack/react-query";
import { CheckCircle, FileText, ListChecks, Users } from "lucide-react";
import { useNavigate } from "react-router";
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
import { orpc } from "@/utils/orpc";

export default function DashboardHome() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  // Fetch data for stats
  const submissionsQuery = useQuery({
    ...orpc.submissions.getQueues.queryOptions(),
    enabled: !!session,
  });

  const judgesQuery = useQuery({
    ...orpc.judges.list.queryOptions({ input: {} }),
    enabled: !!session,
  });

  const totalQueues = submissionsQuery.data?.queues?.length ?? 0;
  const totalSubmissions =
    submissionsQuery.data?.queues?.reduce(
      (sum, q) => sum + q.submissionCount,
      0
    ) ?? 0;
  const totalJudges = judgesQuery.data?.judges?.length ?? 0;
  const activeJudges =
    judgesQuery.data?.judges?.filter((j) => j.isActive).length ?? 0;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <div className="flex flex-col">
          <h1 className="font-semibold text-lg">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back, {session?.user.name}
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Total Submissions
              </CardTitle>
              <FileText className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{totalSubmissions}</div>
              <p className="text-muted-foreground text-xs">
                Across {totalQueues} queue{totalQueues !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Total Judges
              </CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{totalJudges}</div>
              <p className="text-muted-foreground text-xs">
                {activeJudges} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Queues</CardTitle>
              <ListChecks className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{totalQueues}</div>
              <p className="text-muted-foreground text-xs">
                Total evaluation queues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Evaluations</CardTitle>
              <CheckCircle className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">0</div>
              <p className="text-muted-foreground text-xs">
                Completed evaluations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => navigate("/dashboard/submissions")}
          >
            <CardHeader>
              <CardTitle>Upload Submissions</CardTitle>
              <CardDescription>
                Import submission data from JSON files
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => navigate("/dashboard/judges")}
          >
            <CardHeader>
              <CardTitle>Create Judge</CardTitle>
              <CardDescription>
                Set up a new AI judge with custom rubrics
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => navigate("/dashboard/queues")}
          >
            <CardHeader>
              <CardTitle>View Queues</CardTitle>
              <CardDescription>
                Manage and run evaluations on your queues
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Follow these steps to start evaluating submissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                1
              </div>
              <div>
                <p className="font-medium">Upload Submissions</p>
                <p className="text-muted-foreground text-sm">
                  Import your JSON file containing questions and answers
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                2
              </div>
              <div>
                <p className="font-medium">Create AI Judges</p>
                <p className="text-muted-foreground text-sm">
                  Define evaluation criteria and select AI models
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                3
              </div>
              <div>
                <p className="font-medium">Assign & Run</p>
                <p className="text-muted-foreground text-sm">
                  Assign judges to questions and run automated evaluations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
