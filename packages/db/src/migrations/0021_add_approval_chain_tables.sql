CREATE TABLE IF NOT EXISTS "approval_chain_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"label" text NOT NULL,
	"required_role" text,
	"required_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_chain_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diff_report_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "approval_chain_steps" ADD CONSTRAINT "approval_chain_steps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_chain_progress" ADD CONSTRAINT "approval_chain_progress_diff_report_id_diff_reports_id_fk" FOREIGN KEY ("diff_report_id") REFERENCES "diff_reports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_chain_progress" ADD CONSTRAINT "approval_chain_progress_step_id_approval_chain_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "approval_chain_steps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_chain_steps_project_order_idx" ON "approval_chain_steps" ("project_id","step_order");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_chain_progress_diff_step_idx" ON "approval_chain_progress" ("diff_report_id","step_order");
