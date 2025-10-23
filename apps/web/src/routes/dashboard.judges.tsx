import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function Judges() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mr-2 h-4" orientation="vertical" />
        <div className="flex flex-col">
          <h1 className="font-semibold text-lg">Judges</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage AI judges
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>AI Judges</CardTitle>
            <CardDescription>
              Configure AI judges with custom rubrics and models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Coming soon: Judge creation and management
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
