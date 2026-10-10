CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'chat',
  external_key text,
  title text,
  summary text,
  temporary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_kind_key_idx ON conversations (user_id, kind, external_key)
  WHERE external_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text,
  tool_calls jsonb,
  tool_call_id text,
  tool_name text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conv_id_idx ON messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL,
  execution_id uuid,
  status text NOT NULL,
  iterations int NOT NULL DEFAULT 0,
  model text,
  error text,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS agent_runs_user_idx ON agent_runs (user_id, created_at);

CREATE TABLE IF NOT EXISTS agent_run_events (
  id bigserial PRIMARY KEY,
  run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE,
  seq int NOT NULL,
  type text NOT NULL,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id uuid,
  execution_id uuid,
  node_id text,
  tool_name text,
  preview jsonb NOT NULL,
  args jsonb,
  status text NOT NULL DEFAULT 'pending',
  edited_args jsonb,
  decided_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approvals_user_status_idx ON approvals (user_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read);
