import { db, submissions } from "@judge-ai/db";
import { and, desc, eq } from "drizzle-orm";
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

      for (const submission of input) {
        const inserted = await db
          .insert(submissions)
          .values({
            id: submission.id,
            queueId: submission.queueId,
            labelingTaskId: submission.labelingTaskId || null,
            userId,
            questions: submission.questions,
            answers: submission.answers,
            createdAt: new Date(submission.createdAt),
            updatedAt: new Date(),
          })
          .returning();

        if (inserted[0]) {
          insertedSubmissions.push(inserted[0]);
        }
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

      const results = await db
        .select()
        .from(submissions)
        .where(and(...conditions))
        .orderBy(desc(submissions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        submissions: results,
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

    const userSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.userId, userId));

    // Group by queueId and compute stats
    const queuesMap = new Map<
      string,
      {
        queueId: string;
        submissionCount: number;
        questionCount: number;
        lastActivity: Date;
      }
    >();

    for (const submission of userSubmissions) {
      const queueId = submission.queueId;
      const existing = queuesMap.get(queueId);

      if (existing) {
        existing.submissionCount += 1;
        if (submission.createdAt > existing.lastActivity) {
          existing.lastActivity = submission.createdAt;
        }
      } else {
        const questions = submission.questions as Array<{
          data: { id: string };
        }>;
        queuesMap.set(queueId, {
          queueId,
          submissionCount: 1,
          questionCount: questions.length,
          lastActivity: submission.createdAt,
        });
      }
    }

    return {
      queues: Array.from(queuesMap.values()),
    };
  }),
};
