import { useNavigate } from "react-router";
import { toast } from "sonner";
import Loader from "@/components/loader";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { Route } from "./+types/_index";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "AI Judge - Automated Answer Evaluation" },
    {
      name: "description",
      content: "AI-powered submission evaluation platform",
    },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  // Handle sign out
  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Signed out successfully");
        },
      },
    });
  };

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      {/* Theme toggle button in top right */}
      <div className="mb-8 flex justify-end">
        <ModeToggle />
      </div>

      <div className="space-y-8 text-center">
        {/* Title */}
        <h1 className="font-bold text-6xl tracking-tight">AI Judge</h1>

        {/* Summary */}
        <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
          Automated evaluation platform that uses AI to review and grade
          submission answers with intelligent pass/fail verdicts.
        </p>

        {/* Action buttons based on session state */}
        <div className="flex justify-center gap-4 pt-8">
          {session ? (
            <>
              <Button onClick={() => navigate("/dashboard")} size="lg">
                Go to Dashboard
              </Button>
              <Button onClick={handleSignOut} size="lg" variant="outline">
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate("/signin")} size="lg">
                Sign In
              </Button>
              <Button
                onClick={() => navigate("/signup")}
                size="lg"
                variant="outline"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
