-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add native vector column for semantic skill matching
ALTER TABLE skill ADD COLUMN IF NOT EXISTS embedding_vec vector(768);

-- Index for fast cosine distance searches
CREATE INDEX IF NOT EXISTS skill_embedding_vec_idx ON skill USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 10);
