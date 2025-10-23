import {
  db,
  evaluations,
  judges,
  queueJudgeAssignments,
  submissions,
} from "@judge-ai/db";
import { gateway, generateObject } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure } from "../index";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const PASS_RATE_PRECISION = 2;
const MIN_REASONING_LENGTH = 10;
const MAX_REASONING_LENGTH = 500;

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

      // Fetch all submissions for this queue
      const queueSubmissions = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.queueId, input.queueId),
            eq(submissions.userId, userId)
          )
        );

      if (queueSubmissions.length === 0) {
        throw new Error("No submissions found for this queue");
      }

      // Fetch all assignments for this queue
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

      const evaluationResults: (typeof evaluations.$inferSelect)[] = [];
      let completedCount = 0;
      let failedCount = 0;

      // For each submission
      for (const submission of queueSubmissions) {
        const questionsArray = submission.questions as Array<{
          data: { id: string; questionText: string; questionType: string };
        }>;
        const answersMap = submission.answers as Record<
          string,
          { choice?: string; reasoning?: string }
        >;

        // For each assignment (question × judge)
        for (const { assignment, judge } of assignments) {
          if (!judge) {
            continue;
          }

          const questionId = assignment.questionId;
          const question = questionsArray.find((q) => q.data.id === questionId);

          if (!question) {
            continue;
          }

          const answer = answersMap[questionId];

          if (!answer) {
            continue;
          }

          try {
            // Build the prompt for the AI
            const prompt = `Question: ${question.data.questionText}
Question Type: ${question.data.questionType}

User's Answer:
${answer.choice ? `Choice: ${answer.choice}` : ""}
${answer.reasoning ? `Reasoning: ${answer.reasoning}` : ""}

Evaluate this answer according to the rubric provided in the system prompt.`;

            // Track start time for latency measurement
            const startTime = Date.now();

            // Call AI SDK to generate structured evaluation
            const result = await generateObject({
              model: gateway(judge.modelName),
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
                submissionId: submission.id,
                judgeId: judge.id,
                questionId,
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
              await db.insert(evaluations).values({
                id: nanoid(),
                submissionId: submission.id,
                judgeId: judge.id,
                questionId,
                verdict: "inconclusive",
                reasoning: "Evaluation failed due to an error",
                rawResponse: { error: true },
                tokensUsed: 0,
                latencyMs: 0,
                error: error instanceof Error ? error.message : "Unknown error",
                createdAt: new Date(),
              });
            } catch {
              // If we can't even log the error, just continue
            }
          }
        }
      }

      return {
        success: true,
        planned: queueSubmissions.length * assignments.length,
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
        limit: z.number().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        offset: z.number().min(0).default(0),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Build query with joins
      const results = await db
        .select({
          evaluation: evaluations,
          submission: submissions,
          judge: judges,
        })
        .from(evaluations)
        .leftJoin(submissions, eq(evaluations.submissionId, submissions.id))
        .leftJoin(judges, eq(evaluations.judgeId, judges.id))
        .where(eq(submissions.userId, userId))
        .orderBy(desc(evaluations.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Filter results
      let filtered = results;

      if (input.queueId) {
        filtered = filtered.filter(
          (r) => r.submission?.queueId === input.queueId
        );
      }

      if (input.judgeIds && input.judgeIds.length > 0) {
        filtered = filtered.filter((r) =>
          input.judgeIds?.includes(r.evaluation.judgeId)
        );
      }

      if (input.questionIds && input.questionIds.length > 0) {
        filtered = filtered.filter((r) =>
          input.questionIds?.includes(r.evaluation.questionId)
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

      // Fetch all evaluations for user
      const results = await db
        .select({
          evaluation: evaluations,
          submission: submissions,
        })
        .from(evaluations)
        .leftJoin(submissions, eq(evaluations.submissionId, submissions.id))
        .where(eq(submissions.userId, userId));

      // Filter by queueId if provided
      let filtered = results;
      if (input.queueId) {
        filtered = filtered.filter(
          (r) => r.submission?.queueId === input.queueId
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
          submission: submissions,
          judge: judges,
        })
        .from(evaluations)
        .leftJoin(submissions, eq(evaluations.submissionId, submissions.id))
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
