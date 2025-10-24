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

export default function DashboardHome() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

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
