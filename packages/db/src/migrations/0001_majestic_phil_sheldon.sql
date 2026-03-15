CREATE TABLE IF NOT EXISTS "adapter_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter_name" text NOT NULL,
	"retry_after_timestamp" timestamp,
	"rate_limit_type" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adapter_state_adapter_name_unique" UNIQUE("adapter_name")
);
