ALTER TABLE "projects" ADD COLUMN "workspace_id" text NOT NULL DEFAULT 'default';
ALTER TABLE "projects" ALTER COLUMN "workspace_id" DROP DEFAULT;
