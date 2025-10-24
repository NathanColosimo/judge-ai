import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Filter,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { JudgePassRateChart } from "@/components/horizontal-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SUBMISSIONS_TRUNCATE_LENGTH = 8;
const PERCENT_MULTIPLIER = 100;
const DECIMAL_PRECISION = 10;

type EvaluationItem = {
  evaluation: {
    id: string;
    questionId: string;
    verdict: string;
    reasoning: string;
    createdAt: Date;
    tokensUsed: number | null;
    latencyMs: number | null;
    rawResponse: unknown;
  };
  question: {
    submissionId: string;
    questionId: string;
    questionText: string;
    questionType: string;
    answerChoice: string | null;
    answerReasoning: string | null;
  } | null;
  judge: { name: string; modelName: string } | null;
};

// Helper component for verdict badge
function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "pass") {
    return (
      <Badge className="bg-green-500" variant="default">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Pass
      </Badge>
    );
  }

  if (verdict === "fail") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Fail
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <AlertCircle className="mr-1 h-3 w-3" />
      Inconclusive
    </Badge>
  );
}

// Helper component for answer display
function AnswerDisplay({ question }: { question: EvaluationItem["question"] }) {
  const hasAnswer = question?.answerChoice || question?.answerReasoning;

  if (!hasAnswer) {
    return <p className="text-muted-foreground text-sm">No answer provided</p>;
  }

  return (
    <div className="space-y-2">
      {question?.answerChoice && (
        <div>
          <p className="text-muted-foreground text-xs">Choice</p>
          <p className="wrap-break-word text-sm">{question.answerChoice}</p>
        </div>
      )}
      {question?.answerReasoning && (
        <div>
          <p className="text-muted-foreground text-xs">Reasoning</p>
          <p className="wrap-break-word text-sm">{question.answerReasoning}</p>
        </div>
      )}
    </div>
  );
}

// Component for expanded details
function EvaluationDetails({ item }: { item: EvaluationItem }) {
  return (
    <div className="max-w-full space-y-4 overflow-hidden border-t bg-muted/50 p-6">
      {/* Question Section */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Question</h4>
        <div className="space-y-1 rounded-lg border bg-background p-4">
          <p className="text-muted-foreground text-xs">Type</p>
          <p className="wrap-break-word text-sm">
            {item.question?.questionType || "Unknown"}
          </p>
          <p className="mt-2 text-muted-foreground text-xs">Text</p>
          <p className="wrap-break-word text-sm">
            {item.question?.questionText || "Unknown"}
          </p>
        </div>
      </div>

      {/* Answer Section */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">User's Answer</h4>
        <div className="space-y-2 rounded-lg border bg-background p-4">
          <AnswerDisplay question={item.question} />
        </div>
      </div>

      {/* Judge & Verdict Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h4 className="font-semibold text-sm">Judge Details</h4>
          <div className="space-y-2 rounded-lg border bg-background p-4">
            <div>
              <p className="text-muted-foreground text-xs">Name</p>
              <p className="wrap-break-word text-sm">
                {item.judge?.name || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Model</p>
              <p className="break-all font-mono text-xs">
                {item.judge?.modelName || "Unknown"}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <h4 className="font-semibold text-sm">Performance Metrics</h4>
          <div className="space-y-2 rounded-lg border bg-background p-4">
            <div>
              <p className="text-muted-foreground text-xs">Tokens Used</p>
              <p className="text-sm">{item.evaluation.tokensUsed || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Latency</p>
              <p className="text-sm">
                {item.evaluation.latencyMs
                  ? `${item.evaluation.latencyMs}ms`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Created At</p>
              <p className="text-sm">
                {new Date(item.evaluation.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Full Reasoning */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Full Reasoning</h4>
        <div className="rounded-lg border bg-background p-4">
          <p className="wrap-break-word text-sm leading-relaxed">
            {item.evaluation.reasoning}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ResultsSection({
  stats,
  evaluations,
}: {
  stats: {
    total: number;
    passRate: number;
    passCount: number;
    failCount: number;
  };
  evaluations: EvaluationItem[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Get unique judges and questions for filters
  const uniqueJudges = useMemo(() => {
    const judges = new Set<string>();
    for (const item of evaluations) {
      if (item.judge?.name) {
        judges.add(item.judge.name);
      }
    }
    return Array.from(judges);
  }, [evaluations]);

  const uniqueQuestions = useMemo(() => {
    const questions = new Set<string>();
    for (const item of evaluations) {
      if (item.question?.questionText) {
        questions.add(item.question.questionText);
      }
    }
    return Array.from(questions);
  }, [evaluations]);

  // Calculate pass rate per judge for chart
  const judgePassRateData = useMemo(() => {
    const judgeStats = new Map<
      string,
      { passCount: number; totalCount: number }
    >();

    // Count pass/fail per judge
    for (const item of evaluations) {
      const judgeName = item.judge?.name || "Unknown";
      const current = judgeStats.get(judgeName) || {
        passCount: 0,
        totalCount: 0,
      };

      current.totalCount += 1;
      if (item.evaluation.verdict === "pass") {
        current.passCount += 1;
      }

      judgeStats.set(judgeName, current);
    }

    // Convert to chart format
    return Array.from(judgeStats.entries()).map(([judgeName, judgeData]) => ({
      judgeName,
      passRate:
        judgeData.totalCount > 0
          ? Math.round(
              (judgeData.passCount / judgeData.totalCount) *
                PERCENT_MULTIPLIER *
                DECIMAL_PRECISION
            ) / DECIMAL_PRECISION
          : 0,
      passCount: judgeData.passCount,
      totalCount: judgeData.totalCount,
    }));
  }, [evaluations]);

  // Toggle row expansion
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Define columns
  const columns: ColumnDef<EvaluationItem>[] = [
    {
      id: "expand",
      cell: ({ row }) => (
        <Button
          className="h-8 w-8 p-0"
          onClick={() => toggleRow(row.original.evaluation.id)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              expandedRows.has(row.original.evaluation.id) ? "rotate-180" : ""
            }`}
          />
        </Button>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "question.submissionId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Submission" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.question?.submissionId.slice(
            0,
            SUBMISSIONS_TRUNCATE_LENGTH
          ) || "N/A"}
          ...
        </span>
      ),
      filterFn: (row, _id, value) => {
        const submissionId = row.original.question?.submissionId || "";
        return submissionId.includes(value);
      },
    },
    {
      id: "question",
      accessorFn: (row) => row.question?.questionText,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Question" />
      ),
      cell: ({ row }) => (
        <div className="max-w-xs truncate">
          {row.original.question?.questionText || "Unknown"}
        </div>
      ),
      filterFn: (row, _id, value: string[]) => {
        if (!value || value.length === 0) {
          return true;
        }
        return value.includes(row.original.question?.questionText || "");
      },
    },
    {
      id: "judge",
      accessorFn: (row) => row.judge?.name,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Judge" />
      ),
      cell: ({ row }) => row.original.judge?.name || "Unknown",
      filterFn: (row, _id, value: string[]) => {
        if (!value || value.length === 0) {
          return true;
        }
        return value.includes(row.original.judge?.name || "");
      },
    },
    {
      id: "verdict",
      accessorFn: (row) => row.evaluation.verdict,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Verdict" />
      ),
      cell: ({ row }) => (
        <VerdictBadge verdict={row.original.evaluation.verdict} />
      ),
      filterFn: (row, _id, value: string[]) => {
        if (!value || value.length === 0) {
          return true;
        }
        return value.includes(row.original.evaluation.verdict);
      },
    },
    {
      accessorKey: "evaluation.reasoning",
      header: "Reasoning",
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="truncate text-sm">
            {row.original.evaluation.reasoning}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "evaluation.createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) =>
        new Date(row.original.evaluation.createdAt).toLocaleDateString(),
      enableColumnFilter: false,
    },
  ];

  const table = useReactTable({
    data: evaluations,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  // Get current filter values from table state
  const judgeFilter =
    (table.getColumn("judge")?.getFilterValue() as string[]) || [];
  const questionFilter =
    (table.getColumn("question")?.getFilterValue() as string[]) || [];
  const verdictFilter =
    (table.getColumn("verdict")?.getFilterValue() as string[]) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Results</CardTitle>
          <CardDescription>
            Pass rate and detailed evaluation results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Total Evaluations</p>
              <p className="font-bold text-2xl">{stats.total}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Pass Rate</p>
              <p className="font-bold text-2xl text-green-600">
                {stats.passRate}%
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Passed</p>
              <p className="font-bold text-2xl text-green-600">
                {stats.passCount}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">Failed</p>
              <p className="font-bold text-2xl text-red-600">
                {stats.failCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section - Grid for multiple charts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <JudgePassRateChart data={judgePassRateData} />
        {/* Additional charts can be added here */}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evaluation Details</CardTitle>
          <CardDescription>
            Click the arrow to expand and view full evaluation details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 && (
            <p className="text-muted-foreground">No evaluations found</p>
          )}

          {evaluations.length > 0 && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Judge Filter */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" type="button" variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Judge
                      {judgeFilter.length > 0 && (
                        <Badge className="ml-2" variant="secondary">
                          {judgeFilter.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
                    <DropdownMenuLabel>Filter by Judge</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {uniqueJudges.map((judge) => (
                      <DropdownMenuCheckboxItem
                        checked={judgeFilter.includes(judge)}
                        key={judge}
                        onCheckedChange={(checked) => {
                          const newFilter = checked
                            ? [...judgeFilter, judge]
                            : judgeFilter.filter((j) => j !== judge);
                          table
                            .getColumn("judge")
                            ?.setFilterValue(
                              newFilter.length > 0 ? newFilter : undefined
                            );
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {judge}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Question Filter */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" type="button" variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Question
                      {questionFilter.length > 0 && (
                        <Badge className="ml-2" variant="secondary">
                          {questionFilter.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[250px]">
                    <DropdownMenuLabel>Filter by Question</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="max-h-[300px] overflow-y-auto">
                      {uniqueQuestions.map((question) => (
                        <DropdownMenuCheckboxItem
                          checked={questionFilter.includes(question)}
                          key={question}
                          onCheckedChange={(checked) => {
                            const newFilter = checked
                              ? [...questionFilter, question]
                              : questionFilter.filter((q) => q !== question);
                            table
                              .getColumn("question")
                              ?.setFilterValue(
                                newFilter.length > 0 ? newFilter : undefined
                              );
                          }}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <span className="truncate">{question}</span>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Verdict Filter */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" type="button" variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Verdict
                      {verdictFilter.length > 0 && (
                        <Badge className="ml-2" variant="secondary">
                          {verdictFilter.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[150px]">
                    <DropdownMenuLabel>Filter by Verdict</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {["pass", "fail", "inconclusive"].map((verdict) => (
                      <DropdownMenuCheckboxItem
                        checked={verdictFilter.includes(verdict)}
                        key={verdict}
                        onCheckedChange={(checked) => {
                          const newFilter = checked
                            ? [...verdictFilter, verdict]
                            : verdictFilter.filter((v) => v !== verdict);
                          table
                            .getColumn("verdict")
                            ?.setFilterValue(
                              newFilter.length > 0 ? newFilter : undefined
                            );
                        }}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {verdict.charAt(0).toUpperCase() + verdict.slice(1)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Clear Filters */}
                {(judgeFilter.length > 0 ||
                  questionFilter.length > 0 ||
                  verdictFilter.length > 0) && (
                  <Button
                    onClick={() => setColumnFilters([])}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Clear filters
                  </Button>
                )}

                <div className="ml-auto">
                  <DataTableViewOptions table={table} />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length > 0 ? (
                      table.getRowModel().rows.map((row) => {
                        const isExpanded = expandedRows.has(
                          row.original.evaluation.id
                        );
                        return (
                          <>
                            <TableRow
                              data-state={row.getIsSelected() && "selected"}
                              key={row.id}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${row.id}-expanded`}>
                                <TableCell
                                  className="p-0"
                                  colSpan={columns.length}
                                >
                                  <EvaluationDetails item={row.original} />
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          className="h-24 text-center"
                          colSpan={columns.length}
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <DataTablePagination table={table} />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
