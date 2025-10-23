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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

// Questions table - normalized storage for questions and answers
export const questions = pgTable("questions", {
  id: text("id").primaryKey(), // Composite: questionId + submissionId (e.g., "q_template_1_sub_1")
  submissionId: text("submission_id")
    .notNull()
    .references(() => submissions.id, { onDelete: "cascade" }),
  queueId: text("queue_id").notNull(), // Denormalized for faster queries
  questionId: text("question_id").notNull(), // Original question ID from JSON (e.g., "q_template_1")
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull(),
  questionData: jsonb("question_data"), // Additional question metadata (rev, etc)
  answerChoice: text("answer_choice"),
  answerReasoning: text("answer_reasoning"),
  answerData: jsonb("answer_data"), // Additional answer metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}).enableRLS();

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
}).enableRLS();

// Queue judge assignments - many-to-many mapping
// Assigns judges to question IDs (not specific question rows, but the question template)
export const queueJudgeAssignments = pgTable(
  "queue_judge_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    queueId: text("queue_id").notNull(),
    questionId: text("question_id").notNull(), // Original question ID from JSON (e.g., "q_template_1")
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
).enableRLS();

// Evaluations table - stores evaluation results
export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }), // Now references questions table
  judgeId: text("judge_id")
    .notNull()
    .references(() => judges.id, { onDelete: "cascade" }),
  verdict: text("verdict").notNull(), // "pass" | "fail" | "inconclusive"
  reasoning: text("reasoning").notNull(),
  rawResponse: jsonb("raw_response"), // Full LLM response for debugging
  tokensUsed: integer("tokens_used"),
  latencyMs: integer("latency_ms"),
  error: text("error"), // If evaluation failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
}).enableRLS();
