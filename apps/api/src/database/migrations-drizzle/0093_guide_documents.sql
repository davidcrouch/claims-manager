-- Guide documents + chunk embeddings for the online help system.
-- Guides are ingested from docs/guides/*.md and made searchable via pgvector.

CREATE TABLE IF NOT EXISTS guide_document (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  section       TEXT NOT NULL DEFAULT 'operations',
  area          TEXT,
  routes        JSONB NOT NULL DEFAULT '[]',
  audience      TEXT NOT NULL DEFAULT 'all',
  tags          JSONB NOT NULL DEFAULT '[]',
  related_guides JSONB NOT NULL DEFAULT '[]',
  content       TEXT NOT NULL DEFAULT '',
  content_hash  TEXT NOT NULL DEFAULT '',
  version       INTEGER NOT NULL DEFAULT 1,
  file_path     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS guide_document_tenant_slug_uidx
  ON guide_document (tenant_id, slug);
CREATE INDEX IF NOT EXISTS guide_document_tenant_section_idx
  ON guide_document (tenant_id, section);
CREATE INDEX IF NOT EXISTS guide_document_routes_idx
  ON guide_document USING GIN (routes);

CREATE TABLE IF NOT EXISTS guide_chunk (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_document_id  UUID NOT NULL REFERENCES guide_document(id) ON DELETE CASCADE,
  chunk_index        INTEGER NOT NULL DEFAULT 0,
  content            TEXT NOT NULL DEFAULT '',
  token_count        INTEGER NOT NULL DEFAULT 0,
  heading_path       TEXT,
  embedding_vec      vector(768),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guide_chunk_document_idx
  ON guide_chunk (guide_document_id, chunk_index);
CREATE INDEX IF NOT EXISTS guide_chunk_embedding_vec_idx
  ON guide_chunk USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 10);
