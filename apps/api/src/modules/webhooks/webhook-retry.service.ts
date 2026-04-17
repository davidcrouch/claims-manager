import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalEventAttemptsRepository } from '../../database/repositories';
import { InProcessProjectionService } from '../external/in-process-projection.service';
import { ParentRecoveryService } from '../external/parent-recovery.service';
import { ParentNotProjectedError } from '../external/errors/parent-not-projected.error';

export interface RetryContext {
  eventId: string;
  tenantId: string;
  connectionId: string;
  providerEntityType: string;
  providerEntityId: string;
  externalObjectId: string;
  processingLogId: string;
  eventType: string;
}

export interface ScheduleResult {
  scheduled: boolean;
  attemptNumber: number;
  delayMs?: number;
  reason?: string;
}

/**
 * In-process retry scheduler for webhook projections that failed transiently
 * because a parent entity had not yet been projected.
 *
 * Design notes
 * ------------
 * - Retries are scheduled via setTimeout so we don't take a new dependency on
 *   `@nestjs/schedule`. Each scheduled retry is recorded in
 *   `external_event_attempts` so operators can see history in the DB even if
 *   the process restarts. On restart, any still-unprocessed retries are lost
 *   from memory — the existing backfill/sweep mechanism (see
 *   `apps/api/src/modules/webhooks/README.md`) is still the durable fallback.
 * - Before scheduling, we optionally call `ParentRecoveryService` to try an
 *   inline fetch-and-project of the missing parent; if that succeeds we run
 *   the child projection again straight away and skip the deferred retry.
 * - The backoff schedule comes from `webhook.parentRetryBackoffMs`. When the
 *   schedule is exhausted, the event is marked `mapper_failed` and no more
 *   retries are attempted.
 */
@Injectable()
export class WebhookRetryService implements OnModuleDestroy {
  private readonly logger = new Logger('WebhookRetryService');
  private readonly pendingTimers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly inProcProjection: InProcessProjectionService,
    private readonly parentRecovery: ParentRecoveryService,
    private readonly eventAttemptsRepo: ExternalEventAttemptsRepository,
  ) {}

  /**
   * Entry point called by `WebhookOrchestratorService.runInProc` when a
   * ParentNotProjectedError is caught. Attempts inline recovery first, then
   * falls back to a deferred retry.
   *
   * Returns true when the event is now in a good state (either recovered
   * immediately or scheduled for retry). Returns false when we've given up —
   * the caller should then mark the event failed.
   */
  async handleParentNotProjected(params: {
    context: RetryContext;
    error: ParentNotProjectedError;
  }): Promise<{ handled: boolean; recoveredInline: boolean }> {
    const logPrefix = 'WebhookRetryService.handleParentNotProjected';
    const ctx = params.context;

    const attempts = await this.eventAttemptsRepo.findByEventId({
      eventId: ctx.eventId,
    });
    const priorAttempts = attempts.length;

    if (this.inlineRecoveryEnabled()) {
      const outcome = await this.parentRecovery.recover({
        tenantId: ctx.tenantId,
        connectionId: ctx.connectionId,
        providerCode: 'crunchwork',
        error: params.error,
        sourceEventId: ctx.eventId,
      });

      if (outcome.recovered) {
        try {
          await this.inProcProjection.run({
            tenantId: ctx.tenantId,
            connectionId: ctx.connectionId,
            providerEntityType: ctx.providerEntityType,
            externalObjectId: ctx.externalObjectId,
            processingLogId: ctx.processingLogId,
            webhookEventId: ctx.eventId,
          });
          await this.eventAttemptsRepo.create({
            data: {
              eventId: ctx.eventId,
              attemptNumber: priorAttempts + 1,
              status: 'recovered_inline',
              startedAt: new Date(),
              completedAt: new Date(),
              metadata: {
                trigger: 'parent_not_projected',
                recovered: outcome.attempted,
              },
            },
          });
          this.logger.log(
            `${logPrefix} — eventId=${ctx.eventId} recovered inline via parent fetch`,
          );
          return { handled: true, recoveredInline: true };
        } catch (retryErr) {
          const retryMsg = (retryErr as Error).message;
          this.logger.warn(
            `${logPrefix} — eventId=${ctx.eventId} inline re-run after recovery failed: ${retryMsg}`,
          );
          // fall through to deferred retry
          if (ParentNotProjectedError.isInstance(retryErr)) {
            return this.scheduleDeferred({
              context: ctx,
              error: retryErr,
              priorAttempts: priorAttempts + 1,
              inlineRecoverySummary: outcome.attempted,
            });
          }
          return { handled: false, recoveredInline: false };
        }
      }
    }

    return this.scheduleDeferred({
      context: ctx,
      error: params.error,
      priorAttempts,
    });
  }

  private async scheduleDeferred(params: {
    context: RetryContext;
    error: ParentNotProjectedError;
    priorAttempts: number;
    inlineRecoverySummary?: unknown;
  }): Promise<{ handled: boolean; recoveredInline: boolean }> {
    const logPrefix = 'WebhookRetryService.scheduleDeferred';
    const ctx = params.context;

    const backoff = this.getBackoffSchedule();
    const maxAttempts = Math.min(
      backoff.length,
      this.configService.get<number>('webhook.maxParentRetryAttempts', 5),
    );

    if (params.priorAttempts >= maxAttempts) {
      this.logger.error(
        `${logPrefix} — eventId=${ctx.eventId} exhausted retries (${params.priorAttempts}/${maxAttempts}); giving up`,
      );
      await this.eventAttemptsRepo.create({
        data: {
          eventId: ctx.eventId,
          attemptNumber: params.priorAttempts + 1,
          status: 'exhausted',
          startedAt: new Date(),
          completedAt: new Date(),
          errorMessage: params.error.message,
          metadata: {
            trigger: 'parent_not_projected',
            maxAttempts,
            inlineRecovery: params.inlineRecoverySummary,
          },
        },
      });
      return { handled: false, recoveredInline: false };
    }

    const delayMs = backoff[params.priorAttempts];
    const attemptNumber = params.priorAttempts + 1;

    const attempt = await this.eventAttemptsRepo.create({
      data: {
        eventId: ctx.eventId,
        attemptNumber,
        status: 'scheduled',
        startedAt: new Date(),
        errorMessage: params.error.message,
        metadata: {
          trigger: 'parent_not_projected',
          delayMs,
          missingParents: params.error.missingParents,
          inlineRecovery: params.inlineRecoverySummary,
        },
      },
    });

    this.logger.log(
      `${logPrefix} — eventId=${ctx.eventId} scheduling retry attempt=${attemptNumber} delay=${delayMs}ms`,
    );

    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      void this.runRetry({ context: ctx, attemptId: attempt.id, attemptNumber });
    }, delayMs);
    this.pendingTimers.add(timer);

    return { handled: true, recoveredInline: false };
  }

  private async runRetry(params: {
    context: RetryContext;
    attemptId: string;
    attemptNumber: number;
  }): Promise<void> {
    const logPrefix = 'WebhookRetryService.runRetry';
    const ctx = params.context;

    this.logger.log(
      `${logPrefix} — eventId=${ctx.eventId} attempt=${params.attemptNumber} starting`,
    );

    try {
      await this.inProcProjection.run({
        tenantId: ctx.tenantId,
        connectionId: ctx.connectionId,
        providerEntityType: ctx.providerEntityType,
        externalObjectId: ctx.externalObjectId,
        processingLogId: ctx.processingLogId,
        webhookEventId: ctx.eventId,
      });
      await this.eventAttemptsRepo.updateStatus({
        id: params.attemptId,
        status: 'succeeded',
        completedAt: new Date(),
      });
      this.logger.log(
        `${logPrefix} — eventId=${ctx.eventId} attempt=${params.attemptNumber} succeeded`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      await this.eventAttemptsRepo.updateStatus({
        id: params.attemptId,
        status: 'failed',
        completedAt: new Date(),
        errorMessage: msg,
        errorStack: (err as Error).stack,
      });

      if (ParentNotProjectedError.isInstance(err)) {
        this.logger.warn(
          `${logPrefix} — eventId=${ctx.eventId} attempt=${params.attemptNumber} still parent-not-projected; rescheduling`,
        );
        await this.handleParentNotProjected({ context: ctx, error: err });
        return;
      }

      this.logger.error(
        `${logPrefix} — eventId=${ctx.eventId} attempt=${params.attemptNumber} failed with non-retryable error: ${msg}`,
      );
    }
  }

  private getBackoffSchedule(): readonly number[] {
    return this.configService.get<readonly number[]>(
      'webhook.parentRetryBackoffMs',
      [1_000, 5_000, 30_000, 120_000, 300_000],
    );
  }

  private inlineRecoveryEnabled(): boolean {
    return this.configService.get<boolean>(
      'webhook.parentInlineRecoveryEnabled',
      true,
    );
  }

  onModuleDestroy(): void {
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }
}
