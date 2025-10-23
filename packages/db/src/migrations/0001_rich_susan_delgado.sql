CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"queue_id" text NOT NULL,
	"question_id" text NOT NULL,
	"question_text" text NOT NULL,
	"question_type" text NOT NULL,
	"question_data" jsonb,
	"answer_choice" text,
	"answer_reasoning" text,
	"answer_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_submission_id_submissions_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" DROP COLUMN "submission_id";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "questions";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "answers";