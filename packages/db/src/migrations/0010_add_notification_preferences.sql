CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" text NOT NULL UNIQUE,
  "preferences" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
