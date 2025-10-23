import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

// Import available models from API package
const AVAILABLE_MODELS = [
  "google/gemini-2.5-flash-preview-09-2025",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "xai/grok-4-fast-reasoning",
] as const;

const MODEL_DISPLAY_NAMES: Record<(typeof AVAILABLE_MODELS)[number], string> = {
  "google/gemini-2.5-flash-preview-09-2025": "Google Gemini 2.5 Flash",
  "anthropic/claude-haiku-4.5": "Anthropic Claude Haiku 4.5",
  "openai/gpt-5-mini": "OpenAI GPT-5 Mini",
  "xai/grok-4-fast-reasoning": "xAI Grok 4 Fast Reasoning",
};

// Constants for validation
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 5000;

// Form validation schema
const judgeFormSchema = z.object({
  name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH),
  systemPrompt: z.string().min(MIN_PROMPT_LENGTH).max(MAX_PROMPT_LENGTH),
  modelName: z.string().min(MIN_NAME_LENGTH),
  isActive: z.boolean(),
});

type JudgeFormData = z.infer<typeof judgeFormSchema>;

export default function Judges() {
  const { data: session } = authClient.useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<{
    id: string;
    name: string;
    systemPrompt: string;
    modelName: string;
    isActive: boolean;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState<JudgeFormData>({
    name: "",
    systemPrompt: "",
    modelName: AVAILABLE_MODELS[0],
    isActive: true,
  });

  // Fetch judges
  const judgesQuery = useQuery({
    ...orpc.judges.list.queryOptions({ input: {} }),
    enabled: !!session,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: JudgeFormData) => orpc.judges.create.call(data),
    onSuccess: () => {
      toast.success("Judge created successfully");
      queryClient.invalidateQueries();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create judge: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: JudgeFormData & { id: string }) =>
      orpc.judges.update.call(data),
    onSuccess: () => {
      toast.success("Judge updated successfully");
      queryClient.invalidateQueries();
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to update judge: ${error.message}`);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => orpc.judges.toggleActive.call({ id }),
    onSuccess: () => {
      toast.success("Judge status updated");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => orpc.judges.delete.call({ id }),
    onSuccess: () => {
      toast.success("Judge deleted");
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`Failed to delete judge: ${error.message}`);
    },
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      systemPrompt: "",
      modelName: AVAILABLE_MODELS[0],
      isActive: true,
    });
    setEditingJudge(null);
  };

  // Open create dialog
  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleEdit = (judge: {
    id: string;
    name: string;
    systemPrompt: string;
    modelName: string;
    isActive: boolean;
  }) => {
    setEditingJudge(judge);
    setFormData({
      name: judge.name,
      systemPrompt: judge.systemPrompt,
      modelName: judge.modelName,
      isActive: judge.isActive,
    });
    setDialogOpen(true);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      const validated = judgeFormSchema.parse(formData);

      if (editingJudge) {
        // Update existing judge
        updateMutation.mutate({ ...validated, id: editingJudge.id });
      } else {
        // Create new judge
        createMutation.mutate(validated);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        if (firstError) {
          toast.error(`Validation error: ${firstError.message}`);
        }
      }
    }
  };

  const hasJudges = (judgesQuery.data?.judges.length ?? 0) > 0;

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
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-2xl">AI Judges</h2>
            <p className="text-muted-foreground text-sm">
              Configure AI judges with custom rubrics and models
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 size-4" />
            Create Judge
          </Button>
        </div>

        {/* Judges Table */}
        <Card>
          <CardContent className="pt-6">
            {judgesQuery.isLoading && (
              <p className="text-muted-foreground text-sm">Loading...</p>
            )}
            {!judgesQuery.isLoading && hasJudges && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {judgesQuery.data?.judges.map((judge) => (
                    <TableRow key={judge.id}>
                      <TableCell className="font-medium">
                        {judge.name}
                      </TableCell>
                      <TableCell>
                        {MODEL_DISPLAY_NAMES[
                          judge.modelName as keyof typeof MODEL_DISPLAY_NAMES
                        ] || judge.modelName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={judge.isActive ? "default" : "secondary"}
                        >
                          {judge.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(judge.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleEdit(judge)}
                            size="sm"
                            variant="ghost"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            onClick={() =>
                              toggleActiveMutation.mutate(judge.id)
                            }
                            size="sm"
                            variant="ghost"
                          >
                            <Switch checked={judge.isActive} />
                          </Button>
                          <Button
                            onClick={() => deleteMutation.mutate(judge.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!(judgesQuery.isLoading || hasJudges) && (
              <div className="py-12 text-center">
                <p className="mb-4 text-muted-foreground">
                  No judges yet. Create your first AI judge to get started.
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 size-4" />
                  Create Judge
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingJudge ? "Edit Judge" : "Create Judge"}
              </DialogTitle>
              <DialogDescription>
                {editingJudge
                  ? "Update the judge configuration"
                  : "Configure a new AI judge with custom rubrics and model selection"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Strict Grader"
                    required
                    value={formData.name}
                  />
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">System Prompt / Rubric</Label>
                  <Textarea
                    id="systemPrompt"
                    onChange={(e) =>
                      setFormData({ ...formData, systemPrompt: e.target.value })
                    }
                    placeholder="Define the evaluation criteria, rubric, and guidelines for this judge..."
                    required
                    rows={8}
                    value={formData.systemPrompt}
                  />
                  <p className="text-muted-foreground text-xs">
                    {formData.systemPrompt.length} / {MAX_PROMPT_LENGTH}{" "}
                    characters (min {MIN_PROMPT_LENGTH})
                  </p>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="model">AI Model</Label>
                  <Select
                    onValueChange={(value) =>
                      setFormData({ ...formData, modelName: value })
                    }
                    value={formData.modelName}
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {MODEL_DISPLAY_NAMES[model]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isActive}
                    id="active"
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => setDialogOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  type="submit"
                >
                  {editingJudge ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
