import { db, judges } from "@judge-ai/db";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { protectedProcedure } from "../index";

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 5000;

// Router
export const judgesRouter = {
  // Create a new judge
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH),
        systemPrompt: z.string().min(MIN_PROMPT_LENGTH).max(MAX_PROMPT_LENGTH),
        modelName: z.string().min(MIN_NAME_LENGTH), // OpenRouter model name
        isActive: z.boolean().default(true),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const [judge] = await db
        .insert(judges)
        .values({
          id: nanoid(),
          userId,
          name: input.name,
          systemPrompt: input.systemPrompt,
          modelName: input.modelName,
          isActive: input.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return judge;
    }),

  // List all judges for the current user
  list: protectedProcedure
    .input(
      z.object({
        activeOnly: z.boolean().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const conditions = [eq(judges.userId, userId)];
      if (input.activeOnly) {
        conditions.push(eq(judges.isActive, true));
      }

      const results = await db
        .select()
        .from(judges)
        .where(and(...conditions))
        .orderBy(desc(judges.createdAt));

      return {
        judges: results,
      };
    }),

  // Get a single judge by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const [judge] = await db
        .select()
        .from(judges)
        .where(and(eq(judges.id, input.id), eq(judges.userId, userId)))
        .limit(1);

      if (!judge) {
        throw new Error("Judge not found");
      }

      return judge;
    }),

  // Update a judge
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH).optional(),
        systemPrompt: z
          .string()
          .min(MIN_PROMPT_LENGTH)
          .max(MAX_PROMPT_LENGTH)
          .optional(),
        modelName: z.string().min(MIN_NAME_LENGTH).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const { id, ...updateData } = input;

      const [updated] = await db
        .update(judges)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(judges.id, id), eq(judges.userId, userId)))
        .returning();

      if (!updated) {
        throw new Error("Judge not found");
      }

      return updated;
    }),

  // Toggle judge active status
  toggleActive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Get current judge
      const [currentJudge] = await db
        .select()
        .from(judges)
        .where(and(eq(judges.id, input.id), eq(judges.userId, userId)))
        .limit(1);

      if (!currentJudge) {
        throw new Error("Judge not found");
      }

      // Toggle active status
      const [updated] = await db
        .update(judges)
        .set({
          isActive: !currentJudge.isActive,
          updatedAt: new Date(),
        })
        .where(and(eq(judges.id, input.id), eq(judges.userId, userId)))
        .returning();

      return updated;
    }),

  // Delete a judge (soft delete by setting isActive to false)
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session?.user.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Soft delete: set isActive to false
      const [deleted] = await db
        .update(judges)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(judges.id, input.id), eq(judges.userId, userId)))
        .returning();

      if (!deleted) {
        throw new Error("Judge not found");
      }

      return {
        success: true,
        deletedId: input.id,
      };
    }),
};
