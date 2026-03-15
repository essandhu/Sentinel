CREATE TABLE IF NOT EXISTS "diff_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diff_report_id" uuid NOT NULL,
	"category" text NOT NULL,
	"confidence" integer NOT NULL,
	"reasons" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diff_classifications_diff_report_id_unique" UNIQUE("diff_report_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diff_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diff_report_id" uuid NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"rel_x" integer NOT NULL,
	"rel_y" integer NOT NULL,
	"rel_width" integer NOT NULL,
	"rel_height" integer NOT NULL,
	"pixel_count" integer NOT NULL,
	"region_category" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classification_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diff_report_id" uuid NOT NULL,
	"original_category" text NOT NULL,
	"override_category" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diff_classifications" ADD CONSTRAINT "diff_classifications_diff_report_id_diff_reports_id_fk" FOREIGN KEY ("diff_report_id") REFERENCES "public"."diff_reports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diff_regions" ADD CONSTRAINT "diff_regions_diff_report_id_diff_reports_id_fk" FOREIGN KEY ("diff_report_id") REFERENCES "public"."diff_reports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classification_overrides" ADD CONSTRAINT "classification_overrides_diff_report_id_diff_reports_id_fk" FOREIGN KEY ("diff_report_id") REFERENCES "public"."diff_reports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
