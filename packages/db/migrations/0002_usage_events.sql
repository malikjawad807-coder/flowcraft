-- FlowCart v2: Usage events table (Phase 6)
CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider" text,
  "model" text,
  "purpose" text,
  "tokens_in" integer,
  "tokens_out" integer
);

CREATE INDEX IF NOT EXISTS "usage_events_user_at_idx" ON "usage_events" ("user_id", "at");
