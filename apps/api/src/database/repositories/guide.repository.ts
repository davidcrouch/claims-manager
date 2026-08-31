import { Injectable, Inject } from '@nestjs/common';
import { and, eq, sql, isNull, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { guideDocument, guideChunk } from '../schema';

export type GuideDocumentRow = typeof guideDocument.$inferSelect;
export type GuideDocumentInsert = typeof guideDocument.$inferInsert;
export type GuideChunkRow = typeof guideChunk.$inferSelect;
export type GuideChunkInsert = typeof guideChunk.$inferInsert;

export interface GuideSearchResult {
  chunkId: string;
  guideDocumentId: string;
  chunkContent: string;
  headingPath: string | null;
  similarity: number;
  guideSlug: string;
  guideTitle: string;
  guideDescription: string | null;
  guideSection: string;
  guideArea: string | null;
  guideRoutes: string[];
  guideAudience: string;
  guideRelatedGuides: string[];
  guideFilePath: string | null;
}

const KEYWORD_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'how',
  'to',
  'do',
  'i',
  'in',
  'on',
  'of',
  'for',
  'with',
  'my',
  'me',
  'is',
  'are',
  'what',
  'where',
  'when',
  'can',
  'you',
  'please',
  'help',
  'guide',
  'show',
  'tell',
  'about',
  'and',
  'or',
]);

function executeRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (
    result &&
    typeof result === 'object' &&
    'rows' in result &&
    Array.isArray((result as { rows: unknown }).rows)
  ) {
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  return [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

function asJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapVectorSearchRow(row: Record<string, unknown>): GuideSearchResult {
  return {
    chunkId: asString(row.chunk_id ?? row.chunkId),
    guideDocumentId: asString(row.guide_document_id ?? row.guideDocumentId),
    chunkContent: asString(row.chunk_content ?? row.chunkContent),
    headingPath: (row.heading_path ?? row.headingPath) as string | null,
    similarity: Number(row.similarity ?? 0),
    guideSlug: asString(row.guide_slug ?? row.guideSlug),
    guideTitle: asString(row.guide_title ?? row.guideTitle),
    guideDescription: (row.guide_description ?? row.guideDescription) as string | null,
    guideSection: asString(row.guide_section ?? row.guideSection, 'operations'),
    guideArea: (row.guide_area ?? row.guideArea) as string | null,
    guideRoutes: asJsonStringArray(row.guide_routes ?? row.guideRoutes),
    guideAudience: asString(row.guide_audience ?? row.guideAudience, 'all'),
    guideRelatedGuides: asJsonStringArray(
      row.guide_related_guides ?? row.guideRelatedGuides,
    ),
    guideFilePath: (row.guide_file_path ?? row.guideFilePath) as string | null,
  };
}

export function tokenizeHelpQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !KEYWORD_STOPWORDS.has(token));
}

/** Tenant-scoped guides plus global (tenant_id IS NULL) shared guides. */
function tenantScope(tenantId: string | null) {
  if (!tenantId) return isNull(guideDocument.tenantId);
  return or(eq(guideDocument.tenantId, tenantId), isNull(guideDocument.tenantId));
}

@Injectable()
export class GuideRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async upsertDocument(data: GuideDocumentInsert): Promise<GuideDocumentRow> {
    const existing = await this.findExactSlug(data.tenantId ?? null, data.slug);
    if (existing) {
      const [row] = await this.db
        .update(guideDocument)
        .set({
          title: data.title,
          description: data.description,
          section: data.section,
          area: data.area,
          routes: data.routes,
          audience: data.audience,
          tags: data.tags,
          relatedGuides: data.relatedGuides,
          content: data.content,
          contentHash: data.contentHash,
          version: data.version,
          filePath: data.filePath,
          updatedAt: new Date(),
        })
        .where(eq(guideDocument.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await this.db.insert(guideDocument).values(data).returning();
    return row!;
  }

  /** Exact tenant match only (used for upsert identity). */
  private async findExactSlug(
    tenantId: string | null,
    slug: string,
  ): Promise<GuideDocumentRow | null> {
    const condition = tenantId
      ? and(eq(guideDocument.tenantId, tenantId), eq(guideDocument.slug, slug))
      : and(isNull(guideDocument.tenantId), eq(guideDocument.slug, slug));
    const [row] = await this.db.select().from(guideDocument).where(condition).limit(1);
    return row ?? null;
  }

  async findBySlug(tenantId: string | null, slug: string): Promise<GuideDocumentRow | null> {
    // Prefer tenant-specific, then fall back to global
    if (tenantId) {
      const tenantRow = await this.findExactSlug(tenantId, slug);
      if (tenantRow) return tenantRow;
    }
    return this.findExactSlug(null, slug);
  }

  async findByContentHash(tenantId: string | null, hash: string): Promise<GuideDocumentRow | null> {
    const condition = tenantId
      ? and(eq(guideDocument.tenantId, tenantId), eq(guideDocument.contentHash, hash))
      : and(isNull(guideDocument.tenantId), eq(guideDocument.contentHash, hash));
    const [row] = await this.db.select().from(guideDocument).where(condition).limit(1);
    return row ?? null;
  }

  async listDocuments(tenantId: string | null): Promise<GuideDocumentRow[]> {
    return this.db.select().from(guideDocument).where(tenantScope(tenantId));
  }

  async findByRoute(tenantId: string | null, route: string): Promise<GuideDocumentRow[]> {
    const routeMatch = sql`${guideDocument.routes} @> ${JSON.stringify([route])}::jsonb`;
    return this.db
      .select()
      .from(guideDocument)
      .where(and(tenantScope(tenantId), routeMatch));
  }

  /** Loose match when the model passes a page label instead of a pathname. */
  async findByTitleOrSlugHint(
    tenantId: string | null,
    hint: string,
  ): Promise<GuideDocumentRow[]> {
    const cleaned = hint
      .replace(/\bList\b/gi, '')
      .replace(/\bDetail\b/gi, '')
      .trim();
    if (!cleaned) return [];

    const pattern = `%${cleaned.replace(/[%_]/g, '')}%`;
    return this.db
      .select()
      .from(guideDocument)
      .where(
        and(
          tenantScope(tenantId),
          or(
            sql`${guideDocument.title} ILIKE ${pattern}`,
            sql`${guideDocument.slug} ILIKE ${pattern}`,
            sql`${guideDocument.description} ILIKE ${pattern}`,
          ),
        ),
      )
      .limit(5);
  }

  async deleteChunksForDocument(documentId: string): Promise<void> {
    await this.db.delete(guideChunk).where(eq(guideChunk.guideDocumentId, documentId));
  }

  async insertChunks(chunks: GuideChunkInsert[]): Promise<GuideChunkRow[]> {
    if (chunks.length === 0) return [];
    return this.db.insert(guideChunk).values(chunks).returning();
  }

  async vectorSearch(
    queryEmbedding: number[],
    tenantId: string | null,
    topK: number,
    routeBoostPathname?: string,
  ): Promise<GuideSearchResult[]> {
    const vecLiteral = `[${queryEmbedding.join(',')}]`;

    const tenantCondition = tenantId
      ? sql`(gd.tenant_id = ${tenantId} OR gd.tenant_id IS NULL)`
      : sql`gd.tenant_id IS NULL`;

    const executed = await this.db.execute(sql`
      SELECT
        gc.id AS chunk_id,
        gc.guide_document_id,
        gc.content AS chunk_content,
        gc.heading_path,
        1 - (gc.embedding_vec <=> ${vecLiteral}::vector) AS similarity,
        gd.slug AS guide_slug,
        gd.title AS guide_title,
        gd.description AS guide_description,
        gd.section AS guide_section,
        gd.area AS guide_area,
        gd.routes AS guide_routes,
        gd.audience AS guide_audience,
        gd.related_guides AS guide_related_guides,
        gd.file_path AS guide_file_path
      FROM guide_chunk gc
      JOIN guide_document gd ON gd.id = gc.guide_document_id
      WHERE gc.embedding_vec IS NOT NULL
        AND ${tenantCondition}
      ORDER BY gc.embedding_vec <=> ${vecLiteral}::vector
      LIMIT ${topK}
    `);

    let results = executeRows(executed).map(mapVectorSearchRow);

    if (routeBoostPathname) {
      const ROUTE_BOOST = 0.15;
      results = results.map((r) => {
        const matches = r.guideRoutes.some(
          (route: string) =>
            routeBoostPathname === route || routeBoostPathname.startsWith(`${route}/`),
        );
        return matches ? { ...r, similarity: Math.min(1, r.similarity + ROUTE_BOOST) } : r;
      });
      results.sort((a, b) => b.similarity - a.similarity);
    }

    return results;
  }

  /**
   * Title/slug/description/tag/body match so search still works when
   * embeddings are down or the query is a short operational phrase.
   */
  async keywordSearch(
    query: string,
    tenantId: string | null,
    topK: number,
  ): Promise<GuideSearchResult[]> {
    const tokens = tokenizeHelpQuery(query);
    if (tokens.length === 0) return [];

    const docs = await this.db
      .select()
      .from(guideDocument)
      .where(tenantScope(tenantId));

    const scored = docs
      .map((doc) => {
        const title = (doc.title ?? '').toLowerCase();
        const slug = (doc.slug ?? '').toLowerCase().replace(/-/g, ' ');
        const description = (doc.description ?? '').toLowerCase();
        const tags = (doc.tags ?? []).join(' ').toLowerCase();
        const content = (doc.content ?? '').toLowerCase();
        let score = 0;
        for (const token of tokens) {
          if (title.includes(token)) score += 4;
          if (slug.includes(token)) score += 4;
          if (description.includes(token)) score += 3;
          if (tags.includes(token)) score += 2;
          if (content.includes(token)) score += 1;
        }
        return { doc, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const maxScore = scored[0]?.score ?? 1;
    return scored.map(({ doc, score }) => ({
      chunkId: doc.id,
      guideDocumentId: doc.id,
      chunkContent: (doc.description || doc.content.slice(0, 400)).trim(),
      headingPath: doc.title,
      similarity: Math.min(0.99, 0.5 + (score / maxScore) * 0.4),
      guideSlug: doc.slug,
      guideTitle: doc.title,
      guideDescription: doc.description,
      guideSection: doc.section,
      guideArea: doc.area,
      guideRoutes: doc.routes ?? [],
      guideAudience: doc.audience,
      guideRelatedGuides: doc.relatedGuides ?? [],
      guideFilePath: doc.filePath,
    }));
  }

  async getFullContent(documentId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ content: guideDocument.content })
      .from(guideDocument)
      .where(eq(guideDocument.id, documentId))
      .limit(1);
    return row?.content ?? null;
  }
}
