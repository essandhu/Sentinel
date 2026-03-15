CREATE TABLE IF NOT EXISTS "workspace_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" text NOT NULL UNIQUE,
  "slack_webhook_url" text,
  "jira_host" text,
  "jira_email" text,
  "jira_api_token" text,
  "jira_project_key" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
