import {
  db,
  evaluations,
  judges,
  queueJudgeAssignments,
  submissions,
} from "@judge-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure } from "../index";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const PASS_RATE_PRECISION = 2;

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
            // TODO: Call AI SDK here
            // For now, create a placeholder evaluation
            // In the next step, we'll implement the actual AI call

            const [evaluation] = await db
              .insert(evaluations)
              .values({
                id: nanoid(),
                submissionId: submission.id,
                judgeId: judge.id,
                questionId,
                verdict: "inconclusive", // Placeholder
                reasoning: "Evaluation pending - AI integration needed",
                rawResponse: { pending: true },
                tokensUsed: 0,
                latencyMs: 0,
                error: null,
                createdAt: new Date(),
              })
              .returning();

            evaluationResults.push(evaluation);
            completedCount += 1;
          } catch (error) {
            failedCount += 1;
            // Error logged in database, continue processing
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
