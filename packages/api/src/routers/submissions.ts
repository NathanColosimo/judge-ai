import { db, questions, submissions } from "@judge-ai/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Validation schema for submission JSON structure
const questionSchema = z.object({
  rev: z.number(),
  data: z.object({
    id: z.string(),
    questionType: z.string(),
    questionText: z.string(),
  }),
});

const answerSchema = z.object({
  choice: z.string().optional(),
  reasoning: z.string().optional(),
});

const submissionUploadSchema = z.object({
  id: z.string(),
  queueId: z.string(),
  labelingTaskId: z.string().optional(),
  createdAt: z.number(),
  questions: z.array(questionSchema),
  answers: z.record(z.string(), answerSchema),
});

// Router
export const submissionsRouter = {
  // Upload submissions from JSON file
  upload: protectedProcedure
    .input(z.array(submissionUploadSchema))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const insertedSubmissions: (typeof submissions.$inferSelect)[] = [];
      const duplicateIds: string[] = [];

      for (const submission of input) {
        // Check if submission already exists
        const existing = await db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.id, submission.id),
              eq(submissions.userId, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          duplicateIds.push(submission.id);
          continue; // Skip duplicate
        }

        // Insert submission
        const [insertedSubmission] = await db
          .insert(submissions)
          .values({
            id: submission.id,
            queueId: submission.queueId,
            labelingTaskId: submission.labelingTaskId || null,
            userId,
            createdAt: new Date(submission.createdAt),
            updatedAt: new Date(),
          })
          .returning();

        if (insertedSubmission) {
          insertedSubmissions.push(insertedSubmission);

          // Insert questions with answers
          const questionInserts: (typeof questions.$inferInsert)[] = [];
          for (const questionObj of submission.questions) {
            const questionId = questionObj.data.id;
            const answer = submission.answers[questionId];

            questionInserts.push({
              id: `${questionId}_${submission.id}`, // Composite ID
              submissionId: submission.id,
              queueId: submission.queueId,
              questionId,
              questionText: questionObj.data.questionText,
              questionType: questionObj.data.questionType,
              questionData: questionObj,
              answerChoice: answer?.choice || null,
              answerReasoning: answer?.reasoning || null,
              answerData: answer || null,
              createdAt: new Date(),
            });
          }

          if (questionInserts.length > 0) {
            await db.insert(questions).values(questionInserts);
          }
        }
      }

      // Return error if any duplicates found
      if (duplicateIds.length > 0) {
        throw new Error(
          `Duplicate submission IDs found: ${duplicateIds.join(", ")}. These submissions already exist and were skipped.`
        );
      }

      return {
        success: true,
        count: insertedSubmissions.length,
        submissions: insertedSubmissions,
      };
    }),

  // List all submissions for the current user
  list: protectedProcedure
    .input(
      z.object({
        queueId: z.string().optional(),
        limit: z.number().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        offset: z.number().min(0).default(0),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const conditions = [eq(submissions.userId, userId)];
      if (input.queueId) {
        conditions.push(eq(submissions.queueId, input.queueId));
      }

      // Get submissions with question counts
      const results = await db
        .select({
          submission: submissions,
          questionCount: sql<number>`count(${questions.id})`,
        })
        .from(submissions)
        .leftJoin(questions, eq(questions.submissionId, submissions.id))
        .where(and(...conditions))
        .groupBy(submissions.id)
        .orderBy(desc(submissions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        submissions: results.map((r) => ({
          ...r.submission,
          questionCount: Number(r.questionCount),
        })),
        total: results.length,
      };
    }),

  // Get a single submission by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const [submission] = await db
        .select()
        .from(submissions)
        .where(
          and(eq(submissions.id, input.id), eq(submissions.userId, userId))
        )
        .limit(1);

      if (!submission) {
        throw new Error("Submission not found");
      }

      return submission;
    }),

  // Delete a submission
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const deleted = await db
        .delete(submissions)
        .where(
          and(eq(submissions.id, input.id), eq(submissions.userId, userId))
        )
        .returning();

      if (deleted.length === 0) {
        throw new Error("Submission not found");
      }

      return {
        success: true,
        deletedId: input.id,
      };
    }),

  // Get unique queue IDs with stats
  getQueues: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session?.user.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Query queue stats efficiently using aggregations
    const queueStats = await db
      .select({
        queueId: submissions.queueId,
        submissionCount: sql<number>`count(distinct ${submissions.id})`,
        questionCount: sql<number>`count(distinct ${questions.questionId})`,
        lastActivity: sql<Date>`max(${submissions.createdAt})`,
      })
      .from(submissions)
      .leftJoin(questions, eq(questions.submissionId, submissions.id))
      .where(eq(submissions.userId, userId))
      .groupBy(submissions.queueId);

    return {
      queues: queueStats.map((stat) => ({
        queueId: stat.queueId,
        submissionCount: Number(stat.submissionCount),
        questionCount: Number(stat.questionCount),
        lastActivity: stat.lastActivity,
      })),
    };
  }),
};
