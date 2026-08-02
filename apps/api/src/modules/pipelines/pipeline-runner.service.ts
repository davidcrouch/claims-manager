import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import {
  documentPipelineRuns,
  documentPipelineRunSteps,
  documentPipelineSteps,
  documents,
  type PipelineStepConfig,
} from '../../database/schema';
import { SystemAgentRunner } from '../system-agents/system-agent-runner';
import type { PipelineRunMessage } from './pipeline.types';

const LOG = '[PipelineRunnerService]';

@Injectable()
export class PipelineRunnerService {
  private readonly logger = new Logger(PipelineRunnerService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly agentRunner: SystemAgentRunner,
  ) {}

  async executeRun(message: PipelineRunMessage): Promise<void> {
    const { runId, documentId, tenantId } = message;

    const [run] = await this.db
      .select()
      .from(documentPipelineRuns)
      .where(eq(documentPipelineRuns.id, runId))
      .limit(1);

    if (!run || run.status !== 'pending') {
      this.logger.warn(`${LOG}.executeRun run not found or not pending runId=${runId}`);
      return;
    }

    if (!this.agentRunner.isEnabled()) {
      await this.db
        .update(documentPipelineRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: 'GCP_PROJECT_ID not configured (ADC required for Vertex)',
        })
        .where(eq(documentPipelineRuns.id, runId));
      await this.db
        .update(documents)
        .set({
          pipelineStatus: 'failed',
          pipelineError: 'GCP_PROJECT_ID not configured',
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
      return;
    }

    const steps = await this.db
      .select()
      .from(documentPipelineRunSteps)
      .where(eq(documentPipelineRunSteps.runId, runId))
      .orderBy(documentPipelineRunSteps.stepOrder);

    await this.db
      .update(documentPipelineRuns)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(documentPipelineRuns.id, runId));

    await this.db
      .update(documents)
      .set({ pipelineStatus: 'running', updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    let previousOutput: Record<string, unknown> = {};

    for (const step of steps) {
      const stepStart = Date.now();
      await this.db
        .update(documentPipelineRunSteps)
        .set({ status: 'running', startedAt: new Date(), inputContext: previousOutput })
        .where(eq(documentPipelineRunSteps.id, step.id));

      try {
        let stepConfig: PipelineStepConfig = {};
        if (step.stepId) {
          const [stepDef] = await this.db
            .select()
            .from(documentPipelineSteps)
            .where(eq(documentPipelineSteps.id, step.stepId))
            .limit(1);
          stepConfig = (stepDef?.config ?? {}) as PipelineStepConfig;
        }

        const result = await this.agentRunner.run(
          tenantId,
          step.agentId,
          {
            documentId,
            tenantId,
            pipelineRunId: runId,
            previousStepOutput: JSON.stringify(previousOutput),
          },
          stepConfig.prompt ? { prompt: stepConfig.prompt } : undefined,
        );

        const output = { text: result.text, toolResults: result.toolResults };
        previousOutput = output;
        const durationMs = Date.now() - stepStart;

        await this.db
          .update(documentPipelineRunSteps)
          .set({
            status: 'completed',
            completedAt: new Date(),
            outputResult: output,
            durationMs,
          })
          .where(eq(documentPipelineRunSteps.id, step.id));

        this.logger.log(
          `${LOG}.executeRun step completed runId=${runId} agent=${step.agentId} ms=${durationMs}`,
        );
      } catch (err) {
        const durationMs = Date.now() - stepStart;
        const error = err instanceof Error ? err.message : String(err);

        await this.db
          .update(documentPipelineRunSteps)
          .set({ status: 'failed', completedAt: new Date(), error, durationMs })
          .where(eq(documentPipelineRunSteps.id, step.id));

        await this.db
          .update(documentPipelineRuns)
          .set({
            status: 'failed',
            completedAt: new Date(),
            error: `Step ${step.stepOrder} (${step.agentId}) failed: ${error}`,
          })
          .where(eq(documentPipelineRuns.id, runId));

        await this.db
          .update(documents)
          .set({ pipelineStatus: 'failed', pipelineError: error, updatedAt: new Date() })
          .where(eq(documents.id, documentId));

        this.logger.error(`${LOG}.executeRun step failed runId=${runId}: ${error}`);
        return;
      }
    }

    await this.db
      .update(documentPipelineRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(documentPipelineRuns.id, runId));

    const pendingRuns = await this.db
      .select({ id: documentPipelineRuns.id })
      .from(documentPipelineRuns)
      .where(
        and(
          eq(documentPipelineRuns.documentId, documentId),
          inArray(documentPipelineRuns.status, ['pending', 'running']),
        ),
      )
      .limit(1);

    if (pendingRuns.length === 0) {
      await this.db
        .update(documents)
        .set({ pipelineStatus: 'completed', pipelineError: null, updatedAt: new Date() })
        .where(eq(documents.id, documentId));
    }

    this.logger.log(`${LOG}.executeRun completed runId=${runId} steps=${steps.length}`);
  }
}
