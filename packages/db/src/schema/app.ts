import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Submissions table - stores uploaded submission data
export const submissions = pgTable("submissions", {
  id: text("id").primaryKey(),
  queueId: text("queue_id").notNull(),
  labelingTaskId: text("labeling_task_id"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  questions: jsonb("questions").notNull(), // Array of question objects
  answers: jsonb("answers").notNull(), // Object mapping question IDs to answers
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Judges table - AI judge definitions
export const judges = pgTable("judges", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  modelName: text("model_name").notNull(), // OpenRouter model name
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Queue judge assignments - many-to-many mapping
export const queueJudgeAssignments = pgTable(
  "queue_judge_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    queueId: text("queue_id").notNull(),
    questionId: text("question_id").notNull(),
    judgeId: text("judge_id")
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint: one judge can only be assigned once per queue+question
    uniqueAssignment: unique().on(
      table.queueId,
      table.questionId,
      table.judgeId
    ),
  })
);

// Evaluations table - stores evaluation results
export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  judgeId: text("judge_id")
    .notNull()
    .references(() => judges.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  verdict: text("verdict").notNull(), // "pass" | "fail" | "inconclusive"
  reasoning: text("reasoning").notNull(),
  rawResponse: jsonb("raw_response"), // Full LLM response for debugging
  tokensUsed: integer("tokens_used"),
  latencyMs: integer("latency_ms"),
  error: text("error"), // If evaluation failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
