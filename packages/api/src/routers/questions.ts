import { db, questions, submissions } from "@judge-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

// Router
export const questionsRouter = {
  // Get unique questions for a queue (by questionId)
  getUniqueByQueue: protectedProcedure
    .input(z.object({ queueId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Fetch all questions for this queue
      const queueQuestions = await db
        .select()
        .from(questions)
        .leftJoin(submissions, eq(questions.submissionId, submissions.id))
        .where(
          and(
            eq(questions.queueId, input.queueId),
            eq(submissions.userId, userId)
          )
        );

      // Group by questionId to get unique questions
      const uniqueQuestionsMap = new Map<
        string,
        {
          questionId: string;
          questionText: string;
          questionType: string;
          occurrences: number;
        }
      >();

      for (const { questions: q } of queueQuestions) {
        if (!q) {
          continue;
        }

        const existing = uniqueQuestionsMap.get(q.questionId);
        if (existing) {
          existing.occurrences += 1;
        } else {
          uniqueQuestionsMap.set(q.questionId, {
            questionId: q.questionId,
            questionText: q.questionText,
            questionType: q.questionType,
            occurrences: 1,
          });
        }
      }

      return {
        questions: Array.from(uniqueQuestionsMap.values()),
      };
    }),

  // List all questions for a queue
  list: protectedProcedure
    .input(
      z.object({
        queueId: z.string(),
        limit: z.number().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        offset: z.number().min(0).default(0),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const results = await db
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
        )
        .orderBy(desc(questions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        questions: results.map((r) => r.question),
        total: results.length,
      };
    }),

  // Get a single question by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const [result] = await db
        .select({
          question: questions,
          submission: submissions,
        })
        .from(questions)
        .leftJoin(submissions, eq(questions.submissionId, submissions.id))
        .where(and(eq(questions.id, input.id), eq(submissions.userId, userId)))
        .limit(1);

      if (!result) {
        throw new Error("Question not found");
      }

      return result.question;
    }),
};
