#!/usr/bin/env node
/**
 * Ingest markdown guides from docs/guides/ into the guide_document + guide_chunk tables.
 * Usage:  pnpm --filter api guides:ingest [--tenant-id <uuid>]
 *
 * Reads every .md file under docs/guides/ (recursive), parses YAML frontmatter,
 * splits into heading-aware chunks, embeds via Vertex AI, and upserts into Postgres.
 * Unchanged files (by content hash) are skipped automatically.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, '../.env') });

const GUIDES_DIR = resolve(__dirname, '../../../docs/guides');
const CHUNK_TARGET_TOKENS = 500;

function getDatabaseConfig(): ConstructorParameters<typeof Client>[0] {
  const host =
    (process.env.DB_HOST ?? 'localhost').toLowerCase() === 'localhost'
      ? '127.0.0.1'
      : process.env.DB_HOST;
  return {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: (process.env.DB_SSL ?? 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
  };
}

interface Frontmatter {
  title: string;
  slug: string;
  description?: string;
  section: string;
  area?: string;
  routes: string[];
  audience: string;
  tags: string[];
  related_guides: string[];
  version: number;
}

interface Chunk {
  content: string;
  headingPath: string;
  tokenCount: number;
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let currentArray: string[] | null = null;

  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (currentArray !== null) {
      if (trimmed.startsWith('- ')) {
        currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
        continue;
      } else {
        result[currentKey] = currentArray;
        currentArray = null;
      }
    }

    const kvMatch = trimmed.match(/^(\w[\w_]*)\s*:\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1]!;
      const value = kvMatch[2]!.trim();
      if (value === '' || value === '|') {
        currentKey = key;
        currentArray = [];
      } else {
        result[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  if (currentArray !== null) {
    result[currentKey] = currentArray;
  }
  return result;
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; content: string } | null {
  const normalised = raw.replace(/\r\n/g, '\n');
  const match = normalised.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const fm = parseSimpleYaml(match[1]!);
  if (!fm.title || !fm.slug) return null;

  return {
    frontmatter: {
      title: fm.title as string,
      slug: fm.slug as string,
      description: fm.description as string | undefined,
      section: (fm.section as string) ?? 'operations',
      area: fm.area as string | undefined,
      routes: (fm.routes as string[]) ?? [],
      audience: (fm.audience as string) ?? 'all',
      tags: (fm.tags as string[]) ?? [],
      related_guides: (fm.related_guides as string[]) ?? [],
      version: fm.version ? Number(fm.version) : 1,
    },
    content: match[2]!.trim(),
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitIntoChunks(content: string): Chunk[] {
  const lines = content.split('\n');
  const chunks: Chunk[] = [];
  const headingStack: string[] = [];
  let currentLines: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    const text = currentLines.join('\n').trim();
    if (text.length > 0) {
      chunks.push({
        content: text,
        headingPath: headingStack.join(' > '),
        tokenCount: currentTokens,
      });
    }
    currentLines = [];
    currentTokens = 0;
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const title = headingMatch[2]!.trim();
      if (currentTokens > 0) flush();
      while (headingStack.length >= level) headingStack.pop();
      headingStack.push(title);
      currentLines.push(line);
      currentTokens += estimateTokens(line);
    } else {
      const lineTokens = estimateTokens(line);
      if (currentTokens + lineTokens > CHUNK_TARGET_TOKENS * 1.5 && currentTokens > CHUNK_TARGET_TOKENS * 0.5) {
        flush();
      }
      currentLines.push(line);
      currentTokens += lineTokens;
    }
  }
  flush();
  return chunks;
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith('.md') && !entry.startsWith('_')) {
      files.push(full);
    }
  }
  return files;
}

let embeddingClient: { embed: (texts: string[]) => Promise<number[][]> } | null = null;

async function getEmbeddingClient() {
  if (embeddingClient) return embeddingClient;

  const project = process.env.VERTEX_AI_PROJECT || process.env.GCP_PROJECT_ID || '';
  const location = process.env.VERTEX_AI_LOCATION || process.env.VERTEX_LOCATION || 'global';
  const model = process.env.VERTEX_EMBEDDING_MODEL || 'text-embedding-005';

  if (!project) {
    console.warn('  WARNING: Vertex AI not configured — chunks will have no embeddings');
    embeddingClient = { embed: async (texts) => texts.map(() => []) };
    return embeddingClient;
  }

  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ vertexai: true, project, location });

  embeddingClient = {
    embed: async (texts: string[]) => {
      const response = await client.models.embedContent({
        model,
        contents: texts.map((t) => ({ parts: [{ text: t }] })),
        config: { outputDimensionality: 768 },
      });
      return (response.embeddings ?? []).map((e: { values?: number[] }) => e.values ?? []);
    },
  };
  return embeddingClient;
}

async function main() {
  const tenantIdArg = process.argv.includes('--tenant-id')
    ? process.argv[process.argv.indexOf('--tenant-id') + 1]
    : null;

  console.log(`Ingesting guides from ${GUIDES_DIR}`);
  console.log(`Tenant: ${tenantIdArg ?? '(global / null)'}`);

  const client = new Client(getDatabaseConfig());
  await client.connect();

  const files = collectMarkdownFiles(GUIDES_DIR);
  console.log(`Found ${files.length} markdown files\n`);

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (const filePath of files) {
      const relPath = relative(GUIDES_DIR, filePath).replace(/\\/g, '/');
      const raw = readFileSync(filePath, 'utf-8');
      const parsed = parseFrontmatter(raw);

      if (!parsed) {
        console.log(`  SKIP ${relPath} (no valid frontmatter)`);
        skipped++;
        continue;
      }

      const { frontmatter, content } = parsed;
      const contentHash = createHash('sha256').update(raw).digest('hex');

      const existing = await client.query<{ id: string; content_hash: string }>(
        `SELECT id, content_hash FROM guide_document
         WHERE tenant_id IS NOT DISTINCT FROM $1 AND slug = $2
         LIMIT 1`,
        [tenantIdArg, frontmatter.slug],
      );

      if (existing.rows.length > 0 && existing.rows[0]!.content_hash === contentHash) {
        console.log(`  SKIP ${relPath} (unchanged)`);
        skipped++;
        continue;
      }

      try {
        let docId: string;
        if (existing.rows.length > 0) {
          const updated = await client.query<{ id: string }>(
            `UPDATE guide_document SET
              title = $1, description = $2, section = $3, area = $4,
              routes = $5::jsonb, audience = $6, tags = $7::jsonb,
              related_guides = $8::jsonb, content = $9, content_hash = $10,
              version = $11, file_path = $12, updated_at = NOW()
             WHERE id = $13
             RETURNING id`,
            [
              frontmatter.title,
              frontmatter.description ?? null,
              frontmatter.section,
              frontmatter.area ?? null,
              JSON.stringify(frontmatter.routes),
              frontmatter.audience,
              JSON.stringify(frontmatter.tags),
              JSON.stringify(frontmatter.related_guides),
              content,
              contentHash,
              frontmatter.version,
              relPath,
              existing.rows[0]!.id,
            ],
          );
          docId = updated.rows[0]!.id;
        } else {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO guide_document (
              tenant_id, slug, title, description, section, area, routes, audience,
              tags, related_guides, content, content_hash, version, file_path
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14
            )
            RETURNING id`,
            [
              tenantIdArg,
              frontmatter.slug,
              frontmatter.title,
              frontmatter.description ?? null,
              frontmatter.section,
              frontmatter.area ?? null,
              JSON.stringify(frontmatter.routes),
              frontmatter.audience,
              JSON.stringify(frontmatter.tags),
              JSON.stringify(frontmatter.related_guides),
              content,
              contentHash,
              frontmatter.version,
              relPath,
            ],
          );
          docId = inserted.rows[0]!.id;
        }

        await client.query(`DELETE FROM guide_chunk WHERE guide_document_id = $1`, [docId]);

        const chunks = splitIntoChunks(content);
        if (chunks.length > 0) {
          const embedder = await getEmbeddingClient();
          const textsToEmbed = chunks.map((c) => `${c.headingPath}\n${c.content}`);

          const BATCH_SIZE = 20;
          const allEmbeddings: number[][] = [];
          for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
            const batch = textsToEmbed.slice(i, i + BATCH_SIZE);
            const batchEmbeddings = await embedder.embed(batch);
            allEmbeddings.push(...batchEmbeddings);
          }

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]!;
            const vec = allEmbeddings[i];
            const vecLiteral = vec && vec.length > 0 ? `[${vec.join(',')}]` : null;

            await client.query(
              `INSERT INTO guide_chunk (guide_document_id, chunk_index, content, token_count, heading_path, embedding_vec)
               VALUES ($1, $2, $3, $4, $5, $6::vector)`,
              [
                docId,
                i,
                chunk.content,
                chunk.tokenCount,
                chunk.headingPath || null,
                vecLiteral,
              ],
            );
          }
        }

        console.log(`  OK   ${relPath} → slug=${frontmatter.slug} chunks=${chunks.length}`);
        ingested++;
      } catch (err) {
        console.error(`  ERR  ${relPath}: ${err instanceof Error ? err.message : String(err)}`);
        errors++;
      }
    }

    console.log(`\nDone: ${ingested} ingested, ${skipped} skipped, ${errors} errors`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
