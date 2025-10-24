import {
  db,
  evaluations,
  judges,
  questions,
  queueJudgeAssignments,
  submissions,
} from "@judge-ai/db";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { AVAILABLE_MODELS } from "../constants/models";
import { protectedProcedure } from "../index";

const PASS_RATE_PRECISION = 2;
const MIN_REASONING_LENGTH = 10;
const MAX_REASONING_LENGTH = 500;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Evaluation schema for structured output
const evaluationSchema = z.object({
  verdict: z.enum(["pass", "fail", "inconclusive"]),
  reasoning: z.string().min(MIN_REASONING_LENGTH).max(MAX_REASONING_LENGTH),
});

// Helper function to run a single evaluation
async function runSingleEvaluation(
  question: typeof questions.$inferSelect,
  judge: typeof judges.$inferSelect
): Promise<{ success: boolean; evaluation?: typeof evaluations.$inferSelect }> {
  try {
    // Build the prompt for the AI
    const prompt = `Question: ${question.questionText}
Question Type: ${question.questionType}

User's Answer:
${question.answerChoice ? `Choice: ${question.answerChoice}` : ""}
${question.answerReasoning ? `Reasoning: ${question.answerReasoning}` : ""}

Evaluate this answer according to the rubric provided in the system prompt.`;

    // Track start time for latency measurement
    const startTime = Date.now();

    // Call AI SDK to generate structured evaluation
    const result = await generateObject({
      model: openrouter(judge.modelName),
      system: judge.systemPrompt,
      prompt,
      schema: evaluationSchema,
    });

    const latencyMs = Date.now() - startTime;

    // Store evaluation in database
    const [evaluation] = await db
      .insert(evaluations)
      .values({
        id: nanoid(),
        questionId: question.id,
        judgeId: judge.id,
        verdict: result.object.verdict,
        reasoning: result.object.reasoning,
        rawResponse: {
          object: result.object,
          finishReason: result.finishReason,
          usage: result.usage,
          response: {
            id: result.response.id,
            timestamp: result.response.timestamp.toISOString(),
            modelId: result.response.modelId,
          },
        },
        tokensUsed: result.usage.totalTokens,
        latencyMs,
        error: null,
        createdAt: new Date(),
      })
      .returning();

    return { success: true, evaluation };
  } catch (error) {
    // Store failed evaluation with error details
    await db
      .insert(evaluations)
      .values({
        id: nanoid(),
        questionId: question.id,
        judgeId: judge.id,
        verdict: "inconclusive",
        reasoning: error instanceof Error ? error.message : "Unknown error",
        rawResponse: { error: true },
        tokensUsed: 0,
        latencyMs: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        createdAt: new Date(),
      })
      .returning();

    return { success: false };
  }
}

// Helper function to fetch assignments for a queue
function fetchQueueAssignments(queueId: string, userId: string) {
  return db
    .select({
      assignment: queueJudgeAssignments,
      judge: judges,
    })
    .from(queueJudgeAssignments)
    .leftJoin(judges, eq(queueJudgeAssignments.judgeId, judges.id))
    .where(
      and(
        eq(queueJudgeAssignments.queueId, queueId),
        eq(queueJudgeAssignments.userId, userId)
      )
    );
}

// Helper function to fetch questions for a queue
function fetchQueueQuestions(queueId: string, userId: string) {
  return db
    .select({
      question: questions,
      submission: submissions,
    })
    .from(questions)
    .leftJoin(submissions, eq(questions.submissionId, submissions.id))
    .where(and(eq(questions.queueId, queueId), eq(submissions.userId, userId)));
}

// Helper function to build evaluation tasks (for concurrency control)
function buildEvaluationTasks(
  assignments: Awaited<ReturnType<typeof fetchQueueAssignments>>,
  queueQuestions: Awaited<ReturnType<typeof fetchQueueQuestions>>,
  userId: string
) {
  const tasks: Array<
    () => Promise<{
      success: boolean;
      evaluation?: typeof evaluations.$inferSelect;
    }>
  > = [];

  const allowedModels = new Set<string>(AVAILABLE_MODELS as readonly string[]);

  for (const { assignment, judge } of assignments) {
    if (!judge) {
      continue;
    }
    // Enforce judge ownership and model validity
    if (judge.userId !== userId) {
      continue;
    }
    if (!allowedModels.has(judge.modelName)) {
      continue;
    }

    const matchingQuestions = queueQuestions.filter(
      (q) => q.question.questionId === assignment.questionId
    );

    for (const { question } of matchingQuestions) {
      tasks.push(() => runSingleEvaluation(question, judge));
    }
  }

  return tasks;
}

// Run tasks with a fixed concurrency limit and return PromiseSettledResult list
async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      if (current >= tasks.length) {
        break;
      }
      nextIndex += 1;
      try {
        const task = tasks[current];
        if (!task) {
          continue;
        }
        const value = await task();
        results[current] = { status: "fulfilled", value } as const;
      } catch (reason) {
        results[current] = { status: "rejected", reason } as const;
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// Helper function to process evaluation results
function processEvaluationResults(
  results: PromiseSettledResult<{
    success: boolean;
    evaluation?: typeof evaluations.$inferSelect;
  }>[]
) {
  const evaluationResults: (typeof evaluations.$inferSelect)[] = [];
  let completedCount = 0;
  let failedCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.success && result.value.evaluation) {
        evaluationResults.push(result.value.evaluation);
        completedCount += 1;
      } else {
        failedCount += 1;
      }
    } else {
      failedCount += 1;
    }
  }

  return { evaluationResults, completedCount, failedCount };
}

// Router
export const evaluationsRouter = {
  // Run evaluations for a queue
  run: protectedProcedure
    .input(z.object({ queueId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Fetch assignments and questions
      const assignments = await fetchQueueAssignments(input.queueId, userId);
      if (assignments.length === 0) {
        throw new Error("No judge assignments found for this queue");
      }

      const queueQuestions = await fetchQueueQuestions(input.queueId, userId);
      if (queueQuestions.length === 0) {
        throw new Error("No questions found for this queue");
      }

      // Build evaluation tasks and run with concurrency limit
      const CONCURRENCY_LIMIT = 10;
      const tasks = buildEvaluationTasks(assignments, queueQuestions, userId);
      const plannedCount = tasks.length;
      const results = await runWithConcurrencyLimit(tasks, CONCURRENCY_LIMIT);

      // Process results
      const { evaluationResults, completedCount, failedCount } =
        processEvaluationResults(results);

      return {
        success: true,
        planned: plannedCount,
        completed: completedCount,
        failed: failedCount,
        evaluations: evaluationResults,
      };
    }),

  // List evaluations with filters
  list: protectedProcedure
    .input(
      z.object({
        queueId: z.string().optional(),
        judgeIds: z.array(z.string()).optional(),
        questionIds: z.array(z.string()).optional(),
        verdicts: z.array(z.enum(["pass", "fail", "inconclusive"])).optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Build query with joins through questions table
      const results = await db
        .select({
          evaluation: evaluations,
          question: questions,
          submission: submissions,
          judge: judges,
        })
        .from(evaluations)
        .leftJoin(questions, eq(evaluations.questionId, questions.id))
        .leftJoin(submissions, eq(questions.submissionId, submissions.id))
        .leftJoin(judges, eq(evaluations.judgeId, judges.id))
        .where(eq(submissions.userId, userId))
        .orderBy(desc(evaluations.createdAt));

      // Filter results
      let filtered = results;

      if (input.queueId) {
        filtered = filtered.filter(
          (r) => r.question?.queueId === input.queueId
        );
      }

      if (input.judgeIds && input.judgeIds.length > 0) {
        filtered = filtered.filter((r) =>
          input.judgeIds?.includes(r.evaluation.judgeId)
        );
      }

      if (input.questionIds && input.questionIds.length > 0) {
        filtered = filtered.filter((r) =>
          input.questionIds?.includes(r.question?.questionId || "")
        );
      }

      if (input.verdicts && input.verdicts.length > 0) {
        filtered = filtered.filter((r) =>
          input.verdicts?.includes(
            r.evaluation.verdict as "pass" | "fail" | "inconclusive"
          )
        );
      }

      return {
        evaluations: filtered,
        total: filtered.length,
      };
    }),

  // Get evaluation statistics
  stats: protectedProcedure
    .input(
      z.object({
        queueId: z.string().optional(),
        judgeId: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Fetch all evaluations for user through questions table
      const results = await db
        .select({
          evaluation: evaluations,
          question: questions,
          submission: submissions,
        })
        .from(evaluations)
        .leftJoin(questions, eq(evaluations.questionId, questions.id))
        .leftJoin(submissions, eq(questions.submissionId, submissions.id))
        .where(eq(submissions.userId, userId));

      // Filter by queueId if provided
      let filtered = results;
      if (input.queueId) {
        filtered = filtered.filter(
          (r) => r.question?.queueId === input.queueId
        );
      }

      if (input.judgeId) {
        filtered = filtered.filter(
          (r) => r.evaluation.judgeId === input.judgeId
        );
      }

      // Calculate stats
      const total = filtered.length;
      const passCount = filtered.filter(
        (r) => r.evaluation.verdict === "pass"
      ).length;
      const failCount = filtered.filter(
        (r) => r.evaluation.verdict === "fail"
      ).length;
      const inconclusiveCount = filtered.filter(
        (r) => r.evaluation.verdict === "inconclusive"
      ).length;

      // biome-ignore lint/style/noMagicNumbers: Allow magic number for pass rate calculation
      const passRate = total > 0 ? (passCount / total) * 100 : 0;

      return {
        total,
        passCount,
        failCount,
        inconclusiveCount,
        passRate: Number.parseFloat(passRate.toFixed(PASS_RATE_PRECISION)),
      };
    }),

  // Get a single evaluation by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const results = await db
        .select({
          evaluation: evaluations,
          question: questions,
          submission: submissions,
          judge: judges,
        })
        .from(evaluations)
        .leftJoin(questions, eq(evaluations.questionId, questions.id))
        .leftJoin(submissions, eq(questions.submissionId, submissions.id))
        .leftJoin(judges, eq(evaluations.judgeId, judges.id))
        .where(
          and(eq(evaluations.id, input.id), eq(submissions.userId, userId))
        )
        .limit(1);

      if (results.length === 0) {
        throw new Error("Evaluation not found");
      }

      return results[0];
    }),
};
