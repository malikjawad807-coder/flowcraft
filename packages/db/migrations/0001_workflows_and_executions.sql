-- FlowCart v2 Workflows & Executions Migration (Section 8.1)
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'inactive',
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  graph jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workflows_user_idx ON workflows(user_id);

CREATE TABLE IF NOT EXISTS workflow_versions (
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version int NOT NULL,
  graph jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, version)
);

CREATE TABLE IF NOT EXISTS trigger_state (
  workflow_id uuid PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
  cursor text,
  last_polled_at timestamptz,
  last_error text,
  warning text
);

CREATE TABLE IF NOT EXISTS processed_messages (
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workflow_id, gmail_message_id)
);

CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL,   -- trigger | test | manual
  status text NOT NULL, -- queued | running | waiting | success | failed | cancelled
  trigger_data jsonb,
  error text,
  consecutive_fail_marker boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS executions_user_created_idx ON executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS executions_workflow_idx ON executions(workflow_id);

CREATE TABLE IF NOT EXISTS execution_steps (
  id bigserial PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_type text NOT NULL,
  item_index int NOT NULL DEFAULT 0,
  status text NOT NULL, -- running | success | failed | skipped | waiting
  input jsonb,
  output jsonb,
  error text,
  attempts int NOT NULL DEFAULT 0,
  tokens_in int,
  tokens_out int,
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS execution_steps_exec_idx ON execution_steps(execution_id);
