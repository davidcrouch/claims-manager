import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { canvasArtifact } from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class AiCanvasService {
  private readonly logger = new Logger(AiCanvasService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tenantContext: TenantContext,
  ) {}

  async createArtifact(params: {
    conversationId: string;
    title: string;
    contentType?: string;
    content: string;
    language?: string;
    componentName?: string;
    componentProps?: Record<string, unknown>;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiCanvasService.createArtifact] tenant=${tenantId} conversation=${params.conversationId} title=${params.title}`,
    );

    const [artifact] = await this.db
      .insert(canvasArtifact)
      .values({
        tenantId,
        conversationId: params.conversationId,
        title: params.title,
        contentType: params.contentType ?? 'markdown',
        content: params.content,
        language: params.language,
        componentName: params.componentName,
        componentProps: params.componentProps,
      })
      .returning();

    return artifact;
  }

  async updateArtifact(artifactId: string, content: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiCanvasService.updateArtifact] tenant=${tenantId} artifact=${artifactId}`,
    );

    const [existing] = await this.db
      .select()
      .from(canvasArtifact)
      .where(
        and(
          eq(canvasArtifact.id, artifactId),
          eq(canvasArtifact.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing) return null;

    const newVersion = existing.version + 1;
    const [updated] = await this.db
      .update(canvasArtifact)
      .set({
        content,
        version: newVersion,
        updatedAt: sql`now()`,
      })
      .where(eq(canvasArtifact.id, artifactId))
      .returning();

    return updated;
  }

  async getArtifact(artifactId: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiCanvasService.getArtifact] tenant=${tenantId} artifact=${artifactId}`,
    );

    const [artifact] = await this.db
      .select()
      .from(canvasArtifact)
      .where(
        and(
          eq(canvasArtifact.id, artifactId),
          eq(canvasArtifact.tenantId, tenantId),
        ),
      )
      .limit(1);

    return artifact ?? null;
  }

  async deleteArtifact(artifactId: string): Promise<boolean> {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiCanvasService.deleteArtifact] tenant=${tenantId} artifact=${artifactId}`,
    );

    const deleted = await this.db
      .delete(canvasArtifact)
      .where(
        and(
          eq(canvasArtifact.id, artifactId),
          eq(canvasArtifact.tenantId, tenantId),
        ),
      )
      .returning({ id: canvasArtifact.id });

    return deleted.length > 0;
  }

  async listByConversation(conversationId: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiCanvasService.listByConversation] tenant=${tenantId} conversation=${conversationId}`,
    );

    return this.db
      .select()
      .from(canvasArtifact)
      .where(
        and(
          eq(canvasArtifact.tenantId, tenantId),
          eq(canvasArtifact.conversationId, conversationId),
        ),
      )
      .orderBy(desc(canvasArtifact.updatedAt));
  }
}
