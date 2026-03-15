-- Add branch_name column to baselines table for branch-scoped baseline lookups.
-- Existing rows default to 'main' (backward compatible).
ALTER TABLE "baselines" ADD COLUMN "branch_name" text NOT NULL DEFAULT 'main';
