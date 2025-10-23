import { db, judges, queueJudgeAssignments } from "@judge-ai/db";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure } from "../index";

// Router
export const assignmentsRouter = {
  // Assign judges to questions in a queue
  assign: protectedProcedure
    .input(
      z.object({
        queueId: z.string(),
        questionId: z.string(),
        judgeIds: z.array(z.string()),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const inserted: (typeof queueJudgeAssignments.$inferSelect)[] = [];

      for (const judgeId of input.judgeIds) {
        // Check if assignment already exists
        const existing = await db
          .select()
          .from(queueJudgeAssignments)
          .where(
            and(
              eq(queueJudgeAssignments.queueId, input.queueId),
              eq(queueJudgeAssignments.questionId, input.questionId),
              eq(queueJudgeAssignments.judgeId, judgeId),
              eq(queueJudgeAssignments.userId, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue; // Skip if already exists
        }

        const [assignment] = await db
          .insert(queueJudgeAssignments)
          .values({
            id: nanoid(),
            userId,
            queueId: input.queueId,
            questionId: input.questionId,
            judgeId,
            createdAt: new Date(),
          })
          .returning();

        if (assignment) {
          inserted.push(assignment);
        }
      }

      return {
        success: true,
        count: inserted.length,
        assignments: inserted,
      };
    }),

  // Bulk assign: assign one judge to all questions in a queue
  assignJudgeToQueue: protectedProcedure
    .input(
      z.object({
        queueId: z.string(),
        judgeId: z.string(),
        questionIds: z.array(z.string()),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const inserted: (typeof queueJudgeAssignments.$inferSelect)[] = [];

      for (const questionId of input.questionIds) {
        // Check if assignment already exists
        const existing = await db
          .select()
          .from(queueJudgeAssignments)
          .where(
            and(
              eq(queueJudgeAssignments.queueId, input.queueId),
              eq(queueJudgeAssignments.questionId, questionId),
              eq(queueJudgeAssignments.judgeId, input.judgeId),
              eq(queueJudgeAssignments.userId, userId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue; // Skip if already exists
        }

        const [assignment] = await db
          .insert(queueJudgeAssignments)
          .values({
            id: nanoid(),
            userId,
            queueId: input.queueId,
            questionId,
            judgeId: input.judgeId,
            createdAt: new Date(),
          })
          .returning();

        if (assignment) {
          inserted.push(assignment);
        }
      }

      return {
        success: true,
        count: inserted.length,
        assignments: inserted,
      };
    }),

  // Get all assignments for a queue
  getByQueue: protectedProcedure
    .input(z.object({ queueId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

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

      return {
        assignments,
      };
    }),

  // Remove an assignment
  unassign: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const deleted = await db
        .delete(queueJudgeAssignments)
        .where(
          and(
            eq(queueJudgeAssignments.id, input.id),
            eq(queueJudgeAssignments.userId, userId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        throw new Error("Assignment not found");
      }

      return {
        success: true,
        deletedId: input.id,
      };
    }),

  // Remove specific judge from question
  unassignJudgeFromQuestion: protectedProcedure
    .input(
      z.object({
        queueId: z.string(),
        questionId: z.string(),
        judgeId: z.string(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const deleted = await db
        .delete(queueJudgeAssignments)
        .where(
          and(
            eq(queueJudgeAssignments.queueId, input.queueId),
            eq(queueJudgeAssignments.questionId, input.questionId),
            eq(queueJudgeAssignments.judgeId, input.judgeId),
            eq(queueJudgeAssignments.userId, userId)
          )
        )
        .returning();

      return {
        success: true,
        count: deleted.length,
      };
    }),

  // Clear all assignments for a queue
  clearQueue: protectedProcedure
    .input(z.object({ queueId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const deleted = await db
        .delete(queueJudgeAssignments)
        .where(
          and(
            eq(queueJudgeAssignments.queueId, input.queueId),
            eq(queueJudgeAssignments.userId, userId)
          )
        )
        .returning();

      return {
        success: true,
        count: deleted.length,
      };
    }),
};
