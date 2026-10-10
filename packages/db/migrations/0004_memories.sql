-- FlowCart Migration 0004: Long-Term Memory System (Section 11.2)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) <= 500),
  category text NOT NULL,
  importance smallint NOT NULL DEFAULT 3,
  pinned boolean NOT NULL DEFAULT false,
  embedding vector(1536),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED,
  source text NOT NULL DEFAULT 'extracted',
  source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  use_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_user_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_vec_idx ON memories USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS memories_fts_idx ON memories USING gin (fts);
