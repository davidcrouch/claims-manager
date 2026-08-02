import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import {
  documentPipelines,
  documentPipelineSteps,
  documentPipelineRuns,
  documentPipelineRunSteps,
  documents,
  filesystems,
} from '../../database/schema';
import type {
  CreatePipelineDto,
  UpdatePipelineDto,
  PipelineStepInput,
  PipelineRunMessage,
} from './pipeline.types';
import { MAX_PIPELINE_STEPS } from './pipeline.types';
import { PipelineRunnerService } from './pipeline-runner.service';

const LOG = '[PipelineService]';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly topicName: string | null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => PipelineRunnerService))
    private readonly runner: PipelineRunnerService,
  ) {
    this.topicName = this.config.get<string>('PIPELINE_TOPIC_NAME') || null;
  }

  /** Pipelines run whenever GCP ADC project is configured (local/dev and prod). */
  private isGcpConfigured(): boolean {
    return Boolean(this.config.get<string>('GCP_PROJECT_ID'));
  }

  async listPipelines(tenantId: string, filesystemId: string) {
    return this.db
      .select()
      .from(documentPipelines)
      .where(
        and(
          eq(documentPipelines.tenantId, tenantId),
          eq(documentPipelines.filesystemId, filesystemId),
        ),
      )
      .orderBy(documentPipelines.sortOrder);
  }

  async createPipeline(tenantId: string, input: CreatePipelineDto) {
    const [pipeline] = await this.db
      .insert(documentPipelines)
      .values({
        tenantId,
        filesystemId: input.filesystemId ?? null,
        categoryId: input.categoryId ?? null,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        triggerOn: input.triggerOn ?? 'upload_complete',
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    if (input.steps?.length) {
      await this.bulkUpsertSteps(pipeline.id, tenantId, input.steps);
    }

    this.logger.log(`${LOG}.createPipeline id=${pipeline.id} name=${pipeline.name}`);
    return pipeline;
  }

  async updatePipeline(pipelineId: string, tenantId: string, input: UpdatePipelineDto) {
    const [updated] = await this.db
      .update(documentPipelines)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.triggerOn !== undefined && { triggerOn: input.triggerOn }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        updatedAt: new Date(),
      })
      .where(
        and(eq(documentPipelines.id, pipelineId), eq(documentPipelines.tenantId, tenantId)),
      )
      .returning();

    if (!updated) throw new NotFoundException('Pipeline not found');
    return updated;
  }

  async deletePipeline(pipelineId: string, tenantId: string) {
    await this.db
      .delete(documentPipelines)
      .where(
        and(eq(documentPipelines.id, pipelineId), eq(documentPipelines.tenantId, tenantId)),
      );
    return { deleted: true };
  }

  async listSteps(pipelineId: string, tenantId: string) {
    await this.assertPipeline(pipelineId, tenantId);
    return this.db
      .select()
      .from(documentPipelineSteps)
      .where(eq(documentPipelineSteps.pipelineId, pipelineId))
      .orderBy(documentPipelineSteps.stepOrder);
  }

  async bulkUpsertSteps(pipelineId: string, tenantId: string, steps: PipelineStepInput[]) {
    if (steps.length > MAX_PIPELINE_STEPS) {
      throw new Error(`${LOG}.bulkUpsertSteps: max ${MAX_PIPELINE_STEPS} steps`);
    }
    await this.assertPipeline(pipelineId, tenantId);

    await this.db
      .delete(documentPipelineSteps)
      .where(eq(documentPipelineSteps.pipelineId, pipelineId));

    if (steps.length === 0) return [];

    return this.db
      .insert(documentPipelineSteps)
      .values(
        steps.map((s) => ({
          pipelineId,
          agentId: s.agentId,
          stepOrder: s.stepOrder,
          config: s.config ?? {},
        })),
      )
      .returning();
  }

  async getPipelineWithSteps(pipelineId: string, tenantId: string) {
    const pipeline = await this.assertPipeline(pipelineId, tenantId);
    const steps = await this.listSteps(pipelineId, tenantId);
    return { ...pipeline, steps };
  }

  async triggerUploadPipelines(documentId: string, tenantId: string): Promise<void> {
    if (!this.isGcpConfigured()) {
      this.logger.debug(`${LOG}.triggerUploadPipelines skipped — GCP_PROJECT_ID not set`);
      return;
    }

    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)))
      .limit(1);
    if (!doc) return;

    const [fs] = await this.db
      .select()
      .from(filesystems)
      .where(and(eq(filesystems.tenantId, tenantId), isNull(filesystems.archivedAt)))
      .limit(1);
    if (!fs) return;

    const fsPipelines = await this.db
      .select()
      .from(documentPipelines)
      .where(
        and(
          eq(documentPipelines.tenantId, tenantId),
          eq(documentPipelines.isActive, true),
          eq(documentPipelines.triggerOn, 'upload_complete'),
          eq(documentPipelines.filesystemId, fs.id),
          isNull(documentPipelines.categoryId),
        ),
      )
      .orderBy(documentPipelines.sortOrder);

    let catPipelines: (typeof fsPipelines)[number][] = [];
    if (doc.filesystemCategoryId) {
      catPipelines = await this.db
        .select()
        .from(documentPipelines)
        .where(
          and(
            eq(documentPipelines.tenantId, tenantId),
            eq(documentPipelines.isActive, true),
            eq(documentPipelines.triggerOn, 'upload_complete'),
            eq(documentPipelines.categoryId, doc.filesystemCategoryId),
          ),
        )
        .orderBy(documentPipelines.sortOrder);
    }

    const all = [...fsPipelines, ...catPipelines];
    if (all.length === 0) return;

    await this.db
      .update(documents)
      .set({ pipelineStatus: 'pending', updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    for (const pipeline of all) {
      await this.enqueuePipelineRun(documentId, pipeline.id, tenantId);
    }
  }

  async triggerCategoryPipelines(
    documentId: string,
    categoryId: string,
    tenantId: string,
  ): Promise<void> {
    if (!this.isGcpConfigured()) return;

    const catPipelines = await this.db
      .select()
      .from(documentPipelines)
      .where(
        and(
          eq(documentPipelines.tenantId, tenantId),
          eq(documentPipelines.isActive, true),
          eq(documentPipelines.categoryId, categoryId),
        ),
      )
      .orderBy(documentPipelines.sortOrder);

    if (catPipelines.length === 0) return;

    const recentRuns = await this.db
      .select({ pipelineId: documentPipelineRuns.pipelineId })
      .from(documentPipelineRuns)
      .where(
        and(
          eq(documentPipelineRuns.documentId, documentId),
          eq(documentPipelineRuns.tenantId, tenantId),
        ),
      );

    const recentIds = new Set(recentRuns.map((r) => r.pipelineId));
    const needsRun = catPipelines.filter((p) => !recentIds.has(p.id));
    if (needsRun.length === 0) return;

    await this.db
      .update(documents)
      .set({ pipelineStatus: 'pending', updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    for (const pipeline of needsRun) {
      await this.enqueuePipelineRun(documentId, pipeline.id, tenantId);
    }
  }

  private async enqueuePipelineRun(
    documentId: string,
    pipelineId: string,
    tenantId: string,
  ): Promise<string> {
    const [run] = await this.db
      .insert(documentPipelineRuns)
      .values({
        pipelineId,
        documentId,
        tenantId,
        status: 'pending',
      })
      .returning();

    const steps = await this.db
      .select()
      .from(documentPipelineSteps)
      .where(eq(documentPipelineSteps.pipelineId, pipelineId))
      .orderBy(documentPipelineSteps.stepOrder);

    if (steps.length > 0) {
      await this.db.insert(documentPipelineRunSteps).values(
        steps.map((s) => ({
          runId: run.id,
          stepId: s.id,
          agentId: s.agentId,
          stepOrder: s.stepOrder,
          status: 'pending',
        })),
      );
    }

    const message: PipelineRunMessage = {
      runId: run.id,
      pipelineId,
      documentId,
      tenantId,
    };

    // Prefer sync in-process execution for local/dev; Pub/Sub topic reserved for future push.
    if (this.runner) {
      void this.runner.executeRun(message).catch((err) => {
        this.logger.error(
          `${LOG}.enqueuePipelineRun sync failed runId=${run.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    } else {
      this.logger.warn(
        `${LOG}.enqueuePipelineRun no runner; run ${run.id} left pending (topic=${this.topicName})`,
      );
    }

    return run.id;
  }

  async listRuns(documentId: string, tenantId: string) {
    const runs = await this.db
      .select()
      .from(documentPipelineRuns)
      .where(
        and(
          eq(documentPipelineRuns.documentId, documentId),
          eq(documentPipelineRuns.tenantId, tenantId),
        ),
      )
      .orderBy(desc(documentPipelineRuns.createdAt));

    const result = [];
    for (const run of runs) {
      const steps = await this.db
        .select()
        .from(documentPipelineRunSteps)
        .where(eq(documentPipelineRunSteps.runId, run.id))
        .orderBy(documentPipelineRunSteps.stepOrder);
      result.push({ ...run, steps });
    }
    return result;
  }

  private async assertPipeline(pipelineId: string, tenantId: string) {
    const [pipeline] = await this.db
      .select()
      .from(documentPipelines)
      .where(
        and(eq(documentPipelines.id, pipelineId), eq(documentPipelines.tenantId, tenantId)),
      )
      .limit(1);
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }
}
