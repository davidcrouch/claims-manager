import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { skill } from '../schema';
import type { SkillConfig, SkillToolRef, SkillVisibility } from '../../modules/skills/skill.types';

export type SkillRow = typeof skill.$inferSelect;
export type SkillInsert = typeof skill.$inferInsert;

@Injectable()
export class SkillRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async insert(data: SkillInsert): Promise<SkillConfig> {
    const [row] = await this.db.insert(skill).values(data).returning();
    return this.toConfig(row!);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<SkillInsert>,
  ): Promise<SkillConfig | null> {
    const [row] = await this.db
      .update(skill)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(skill.id, id), eq(skill.tenantId, tenantId)))
      .returning();
    return row ? this.toConfig(row) : null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(skill)
      .where(and(eq(skill.id, id), eq(skill.tenantId, tenantId)))
      .returning({ id: skill.id });
    return deleted.length > 0;
  }

  async findById(id: string, tenantId?: string): Promise<SkillConfig | null> {
    const conditions = tenantId
      ? and(eq(skill.id, id), eq(skill.tenantId, tenantId))
      : eq(skill.id, id);
    const [row] = await this.db.select().from(skill).where(conditions).limit(1);
    return row ? this.toConfig(row) : null;
  }

  async findByIds(ids: string[], tenantId?: string): Promise<SkillConfig[]> {
    if (ids.length === 0) return [];
    const conditions = tenantId
      ? and(inArray(skill.id, ids), eq(skill.tenantId, tenantId))
      : inArray(skill.id, ids);
    const rows = await this.db.select().from(skill).where(conditions);
    return rows.map((row) => this.toConfig(row));
  }

  async findByTenant(tenantId: string): Promise<SkillConfig[]> {
    const rows = await this.db
      .select()
      .from(skill)
      .where(eq(skill.tenantId, tenantId))
      .orderBy(desc(skill.updatedAt));
    return rows.map((row) => this.toConfig(row));
  }

  async findVisible(tenantId: string): Promise<SkillConfig[]> {
    const rows = await this.db
      .select()
      .from(skill)
      .where(
        or(
          and(eq(skill.tenantId, tenantId), eq(skill.visibility, 'org')),
          eq(skill.visibility, 'public'),
        ),
      )
      .orderBy(desc(skill.updatedAt));
    return rows.map((row) => this.toConfig(row));
  }

  async updateEmbedding(id: string, embeddingVec: number[]): Promise<void> {
    const vecLiteral = `[${embeddingVec.join(',')}]`;
    await this.db
      .update(skill)
      .set({
        embedding: embeddingVec,
        embeddingVec,
        updatedAt: new Date(),
      })
      .where(eq(skill.id, id));
  }

  async vectorSearch(
    queryEmbedding: number[],
    tenantId: string,
    topK: number,
    excludeIds: string[],
  ): Promise<Array<SkillConfig & { similarity: number }>> {
    const vecLiteral = `[${queryEmbedding.join(',')}]`;

    const excludeCondition =
      excludeIds.length > 0
        ? sql`AND ${skill.id} NOT IN (${sql.join(
            excludeIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;

    const rows = await this.db.execute(sql`
      SELECT *,
        1 - (embedding_vec <=> ${vecLiteral}::vector) AS similarity
      FROM skill
      WHERE embedding_vec IS NOT NULL
        AND (tenant_id = ${tenantId} OR visibility = 'public')
        ${excludeCondition}
      ORDER BY embedding_vec <=> ${vecLiteral}::vector
      LIMIT ${topK}
    `);

    return (rows as unknown as Array<SkillRow & { similarity: number }>).map((row) => ({
      ...this.toConfig(row),
      similarity: Number(row.similarity),
    }));
  }

  private toConfig(row: SkillRow): SkillConfig {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description,
      triggerHints: row.triggerHints ?? [],
      instructionPrompt: row.instructionPrompt,
      requiredToolRefs: (row.requiredToolRefs as SkillToolRef[] | null) ?? [],
      inputSchema: row.inputSchema as Record<string, unknown> | null,
      outputSchema: row.outputSchema as Record<string, unknown> | null,
      invocationMode: row.invocationMode as SkillConfig['invocationMode'],
      includeHistory: row.includeHistory,
      historyMessageCount: row.historyMessageCount,
      modelOverride: row.modelOverride,
      providerOverride: row.providerOverride,
      category: row.category,
      visibility: row.visibility as SkillVisibility,
      embedding: row.embedding as number[] | null,
      packInstallId: row.packInstallId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

