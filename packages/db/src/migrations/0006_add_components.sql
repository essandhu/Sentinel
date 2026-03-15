CREATE TABLE IF NOT EXISTS "components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "name" text NOT NULL,
  "selector" text NOT NULL,
  "description" text,
  "enabled" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "component_id" uuid REFERENCES "components"("id");

CREATE INDEX IF NOT EXISTS "components_project_id_idx" ON "components" ("project_id");
CREATE INDEX IF NOT EXISTS "snapshots_component_id_idx" ON "snapshots" ("component_id");
