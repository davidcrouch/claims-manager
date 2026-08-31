import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GuideRepository } from '../../repositories/guide.repository';
import { GuideService } from '../../../modules/guides/guide.service';
import type { EmbeddingService } from '../../../modules/ai-chat/embedding.service';
import type { DrizzleDB } from '../../drizzle.module';
import type { SeedDb } from '../lib/db';
import { createGuideEmbeddingClient, type GuidesIngestLogger } from '../lib/guide-embedding';

export type { GuidesIngestLogger };

export interface GuidesIngestResult {
  ingested: number;
  skipped: number;
  errors: number;
  guidesDir: string;
}

/** Resolve docs/guides for Docker (apps/api/docs/guides) or monorepo checkout. */
export function resolveGuidesDir(scriptDir: string): string {
  if (process.env.GUIDES_DIR?.trim()) {
    return process.env.GUIDES_DIR.trim();
  }

  const candidates = [
    join(scriptDir, '../../docs/guides'),
    join(scriptDir, '../../../../docs/guides'),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }

  throw new Error(
    `[guides-ingest] guides directory not found (tried ${candidates.join(', ')}); set GUIDES_DIR`,
  );
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

/**
 * Idempotent ingest of markdown guides into guide_document + guide_chunk.
 * Used by local CLI and Cloud Run job ingest-api-guides.
 */
export async function ingestGuidesFromDisk(options: {
  db: SeedDb;
  logger: GuidesIngestLogger;
  guidesDir: string;
  tenantId?: string | null;
}): Promise<GuidesIngestResult> {
  const { db, logger, guidesDir, tenantId = null } = options;
  const guideRepo = new GuideRepository(db as DrizzleDB);
  const embedding = createGuideEmbeddingClient(logger);
  const guideService = new GuideService(
    guideRepo,
    embedding as unknown as EmbeddingService,
  );

  const files = collectMarkdownFiles(guidesDir);
  logger.info(`[guides-ingest] scanning ${guidesDir} (${files.length} markdown files)`);

  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for (const filePath of files) {
    const relPath = relative(guidesDir, filePath).replace(/\\/g, '/');
    const raw = readFileSync(filePath, 'utf-8');

    try {
      guideService.parseFrontmatter(raw);
    } catch {
      logger.info(`[guides-ingest] SKIP ${relPath} (no valid frontmatter)`);
      skipped++;
      continue;
    }

    try {
      const result = await guideService.ingestGuide(raw, relPath, tenantId);
      if (result.skipped) {
        logger.info(`[guides-ingest] SKIP ${relPath} (unchanged)`);
        skipped++;
      } else {
        logger.info(
          `[guides-ingest] OK ${relPath} chunks=${result.chunksCreated}`,
        );
        ingested++;
      }
    } catch (err) {
      logger.error(
        `[guides-ingest] ERR ${relPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      errors++;
    }
  }

  return { ingested, skipped, errors, guidesDir };
}
