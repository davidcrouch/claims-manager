import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { GuideRepository, type GuideDocumentRow, type GuideSearchResult } from '../../database/repositories/guide.repository';
import { EmbeddingService } from '../ai-chat/embedding.service';

const LOG_PREFIX = 'GuideService';
const CHUNK_TARGET_TOKENS = 500;
const MIN_SIMILARITY = 0.35;

export interface GuideFrontmatter {
  title: string;
  slug: string;
  description?: string;
  section: string;
  area?: string;
  routes?: string[];
  audience?: string;
  tags?: string[];
  related_guides?: string[];
  version?: number;
  last_updated?: string;
}

export interface ParsedGuide {
  frontmatter: GuideFrontmatter;
  content: string;
}

export interface GuideChunkData {
  content: string;
  headingPath: string;
  tokenCount: number;
}

@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);

  constructor(
    private readonly guideRepo: GuideRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  parseFrontmatter(raw: string): ParsedGuide {
    const normalised = raw.replace(/\r\n/g, '\n');
    const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
    const match = normalised.match(fmRegex);
    if (!match) {
      throw new Error(`[${LOG_PREFIX}.parseFrontmatter] no YAML frontmatter found`);
    }

    const yamlBlock = match[1]!;
    const content = match[2]!.trim();
    const fm = this.parseSimpleYaml(yamlBlock);

    if (!fm.title || !fm.slug) {
      throw new Error(`[${LOG_PREFIX}.parseFrontmatter] frontmatter must have title and slug`);
    }

    return {
      frontmatter: {
        title: fm.title as string,
        slug: fm.slug as string,
        description: fm.description as string | undefined,
        section: (fm.section as string) ?? 'operations',
        area: fm.area as string | undefined,
        routes: fm.routes as string[] | undefined,
        audience: (fm.audience as string) ?? 'all',
        tags: fm.tags as string[] | undefined,
        related_guides: fm.related_guides as string[] | undefined,
        version: fm.version ? Number(fm.version) : 1,
        last_updated: fm.last_updated as string | undefined,
      },
      content,
    };
  }

  /**
   * Split markdown content into chunks by headings, targeting ~CHUNK_TARGET_TOKENS tokens per chunk.
   * Preserves heading hierarchy for context.
   */
  splitIntoChunks(content: string): GuideChunkData[] {
    const lines = content.split('\n');
    const chunks: GuideChunkData[] = [];
    const headingStack: string[] = [];
    let currentLines: string[] = [];
    let currentTokens = 0;

    const flushChunk = () => {
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

        if (currentTokens > 0) {
          flushChunk();
        }

        while (headingStack.length >= level) {
          headingStack.pop();
        }
        headingStack.push(title);

        currentLines.push(line);
        currentTokens += this.estimateTokens(line);
      } else {
        const lineTokens = this.estimateTokens(line);

        if (currentTokens + lineTokens > CHUNK_TARGET_TOKENS * 1.5 && currentTokens > CHUNK_TARGET_TOKENS * 0.5) {
          flushChunk();
        }

        currentLines.push(line);
        currentTokens += lineTokens;
      }
    }

    flushChunk();
    return chunks;
  }

  async ingestGuide(
    raw: string,
    filePath: string | null,
    tenantId: string | null,
  ): Promise<{ documentId: string; chunksCreated: number; skipped: boolean }> {
    const { frontmatter, content } = this.parseFrontmatter(raw);
    const contentHash = createHash('sha256').update(raw).digest('hex');

    const existing = await this.guideRepo.findBySlug(tenantId, frontmatter.slug);
    if (existing && existing.contentHash === contentHash) {
      this.logger.log(`[${LOG_PREFIX}.ingestGuide] skipped (unchanged) slug=${frontmatter.slug}`);
      return { documentId: existing.id, chunksCreated: 0, skipped: true };
    }

    const doc = await this.guideRepo.upsertDocument({
      tenantId,
      slug: frontmatter.slug,
      title: frontmatter.title,
      description: frontmatter.description ?? null,
      section: frontmatter.section,
      area: frontmatter.area ?? null,
      routes: frontmatter.routes ?? [],
      audience: frontmatter.audience ?? 'all',
      tags: frontmatter.tags ?? [],
      relatedGuides: frontmatter.related_guides ?? [],
      content,
      contentHash,
      version: frontmatter.version ?? 1,
      filePath,
    });

    await this.guideRepo.deleteChunksForDocument(doc.id);

    const chunks = this.splitIntoChunks(content);
    this.logger.log(
      `[${LOG_PREFIX}.ingestGuide] slug=${frontmatter.slug} chunks=${chunks.length}`,
    );

    if (chunks.length === 0) {
      return { documentId: doc.id, chunksCreated: 0, skipped: false };
    }

    const textsToEmbed = chunks.map((c) => `${c.headingPath}\n${c.content}`);
    const embeddings = await this.embeddingService.embedBatch(textsToEmbed);

    const chunkInserts = chunks.map((chunk, i) => ({
      guideDocumentId: doc.id,
      chunkIndex: i,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      headingPath: chunk.headingPath || null,
      embeddingVec: embeddings[i]?.length ? embeddings[i] : undefined,
    }));

    await this.guideRepo.insertChunks(chunkInserts);

    return { documentId: doc.id, chunksCreated: chunks.length, skipped: false };
  }

  async searchGuides(
    query: string,
    tenantId: string | null,
    options?: { topK?: number; routeBoost?: string },
  ): Promise<GuideSearchResult[]> {
    const topK = options?.topK ?? 5;
    try {
      const keywordHits = await this.guideRepo.keywordSearch(query, tenantId, topK);

      let vectorHits: GuideSearchResult[] = [];
      if (this.embeddingService.isConfigured()) {
        try {
          const embedding = await this.embeddingService.embed(query);
          if (embedding.length > 0) {
            vectorHits = await this.guideRepo.vectorSearch(
              embedding,
              tenantId,
              topK,
              options?.routeBoost,
            );
            vectorHits = vectorHits.filter((hit) => hit.similarity >= MIN_SIMILARITY);
          }
        } catch (err) {
          this.logger.warn(
            `[${LOG_PREFIX}.searchGuides] vector search failed, using keyword fallback: ${String(err)}`,
          );
        }
      } else {
        this.logger.warn(
          `[${LOG_PREFIX}.searchGuides] embeddings not configured — keyword search only`,
        );
      }

      const bySlug = new Map<string, GuideSearchResult>();
      for (const hit of [...keywordHits, ...vectorHits]) {
        if (!hit.guideSlug) continue;
        const existing = bySlug.get(hit.guideSlug);
        if (!existing || hit.similarity > existing.similarity) {
          bySlug.set(hit.guideSlug, hit);
        }
      }

      return [...bySlug.values()]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (err) {
      this.logger.error(
        `[${LOG_PREFIX}.searchGuides] search failed: ${String(err)}`,
      );
      return [];
    }
  }

  async getGuideContent(tenantId: string | null, slug: string): Promise<GuideDocumentRow | null> {
    return this.guideRepo.findBySlug(tenantId, slug);
  }

  async getGuidesByRoute(tenantId: string | null, route: string): Promise<GuideDocumentRow[]> {
    const trimmed = route?.trim();
    if (!trimmed) return [];

    // Primary: exact pathname match against guide frontmatter routes
    if (trimmed.startsWith('/')) {
      const exact = await this.guideRepo.findByRoute(tenantId, trimmed);
      if (exact.length > 0) return exact;

      // Try parent paths: /admin/roles/xyz → /admin/roles
      const parts = trimmed.split('/').filter(Boolean);
      while (parts.length > 1) {
        parts.pop();
        const parent = `/${parts.join('/')}`;
        const found = await this.guideRepo.findByRoute(tenantId, parent);
        if (found.length > 0) return found;
      }
      return [];
    }

    // Fallback: model sometimes passes the page label instead of pathname
    return this.guideRepo.findByTitleOrSlugHint(tenantId, trimmed);
  }

  async listGuides(tenantId: string | null): Promise<GuideDocumentRow[]> {
    return this.guideRepo.listDocuments(tenantId);
  }

  async getFullContent(documentId: string): Promise<string | null> {
    return this.guideRepo.getFullContent(documentId);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private parseSimpleYaml(yaml: string): Record<string, unknown> {
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
}
