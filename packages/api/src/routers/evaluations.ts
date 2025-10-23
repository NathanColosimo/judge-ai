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
  confidence: z.number().min(0).max(1).optional(),
});

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

      // Fetch all judge assignments for this queue
      const assignments = await db
        .select({
          assignment: queueJudgeAssignments,
          judge: judges,
        })
        .from(queueJudgeAssignments)
        .leftJoin(judges, eq(queueJudgeAssignments.judgeId, judges.id))
        .where(
          and(
            eq(queueJudgeAssignments.queueId, input.queueId),
            eq(queueJudgeAssignments.userId, userId)
          )
        );

      if (assignments.length === 0) {
        throw new Error("No judge assignments found for this queue");
      }

      // Fetch all questions for this queue that match assigned question IDs
      const queueQuestions = await db
        .select({
          question: questions,
          submission: submissions,
        })
        .from(questions)
        .leftJoin(submissions, eq(questions.submissionId, submissions.id))
        .where(
          and(
            eq(questions.queueId, input.queueId),
            eq(submissions.userId, userId)
          )
        );

      if (queueQuestions.length === 0) {
        throw new Error("No questions found for this queue");
      }

      const evaluationResults: (typeof evaluations.$inferSelect)[] = [];
      let completedCount = 0;
      let failedCount = 0;

      // For each question × judge assignment
      for (const { assignment, judge } of assignments) {
        if (!judge) {
          continue;
        }

        // Find all questions that match this assignment's questionId
        const matchingQuestions = queueQuestions.filter(
          (q) => q.question.questionId === assignment.questionId
        );

        for (const { question } of matchingQuestions) {
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
                questionId: question.id, // Now references the questions table
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

            if (evaluation) {
              evaluationResults.push(evaluation);
              completedCount += 1;
            }
          } catch (error) {
            failedCount += 1;

            // Store failed evaluation with error details
            try {
              await db
                .insert(evaluations)
                .values({
                  id: nanoid(),
                  questionId: question.id,
                  judgeId: judge.id,
                  verdict: "inconclusive",
                  reasoning:
                    error instanceof Error ? error.message : "Unknown error",
                  rawResponse: { error: true },
                  tokensUsed: 0,
                  latencyMs: 0,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                  createdAt: new Date(),
                })
                .returning();
            } catch (secondaryError) {
              console.error(secondaryError);
            }
          }
        }
      }

      return {
        success: true,
        planned: queueQuestions.length * assignments.length,
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
