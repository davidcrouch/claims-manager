import { ConfigService } from '@nestjs/config';
import { WebhookOrchestratorService } from './webhook-orchestrator.service';
import { More0Service } from '../../more0/more0.service';
import { InProcessProjectionService } from '../external/in-process-projection.service';
import { WebhookRetryService } from './webhook-retry.service';
import {
  ExternalProcessingLogRepository,
  InboundWebhookEventsRepository,
} from '../../database/repositories';

describe('WebhookOrchestratorService', () => {
  const buildConfig = (values: Record<string, unknown>): ConfigService =>
    ({
      get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    }) as unknown as ConfigService;

  const buildDeps = (configOverrides: Record<string, unknown> = {}) => {
    const config = buildConfig({
      'webhook.processingMode': 'inproc',
      'webhook.inProcMappingEnabled': true,
      'more0.enabled': false,
      'more0.apiKey': '',
      ...configOverrides,
    });
    const more0 = {
      invokeViaGateway: jest.fn(),
    } as unknown as jest.Mocked<More0Service>;
    const inProc = {
      run: jest.fn(),
    } as unknown as jest.Mocked<InProcessProjectionService>;
    const retry = {
      handleParentNotProjected: jest.fn(),
    } as unknown as jest.Mocked<WebhookRetryService>;
    const processingLogRepo = {
      updateStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ExternalProcessingLogRepository>;
    const webhookRepo = {
      updateProcessingStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InboundWebhookEventsRepository>;

    const service = new WebhookOrchestratorService(
      config,
      more0,
      inProc,
      retry,
      processingLogRepo,
      webhookRepo,
    );
    return { service, more0, inProc, processingLogRepo, webhookRepo };
  };

  describe('resolveRoute', () => {
    it('returns "more0" when mode=more0 and enabled + apiKey present', () => {
      const { service } = buildDeps({
        'webhook.processingMode': 'more0',
        'more0.enabled': true,
        'more0.apiKey': 'k',
      });
      expect(service.resolveRoute()).toBe('more0');
    });

    it('falls back to "inproc" when mode=more0 but more0 not configured', () => {
      const { service } = buildDeps({
        'webhook.processingMode': 'more0',
        'more0.enabled': false,
        'more0.apiKey': '',
      });
      expect(service.resolveRoute()).toBe('inproc');
    });

    it('returns "inproc" when mode=inproc', () => {
      const { service } = buildDeps({ 'webhook.processingMode': 'inproc' });
      expect(service.resolveRoute()).toBe('inproc');
    });

    it('returns "none" when both modes disabled', () => {
      const { service } = buildDeps({
        'webhook.processingMode': 'inproc',
        'webhook.inProcMappingEnabled': false,
      });
      expect(service.resolveRoute()).toBe('none');
    });
  });

  describe('finalize on more0 route', () => {
    it('dispatches to gateway, writes workflowRunId to log, flips event to dispatched', async () => {
      const { service, more0, processingLogRepo, webhookRepo } = buildDeps({
        'webhook.processingMode': 'more0',
        'more0.enabled': true,
        'more0.apiKey': 'k',
      });
      (more0.invokeViaGateway as jest.Mock).mockResolvedValue({
        runId: 'run-abc',
        status: 'running',
      });

      const result = await service.finalize({
        eventId: 'evt-1',
        tenantId: 't-1',
        connectionId: 'c-1',
        providerEntityType: 'job',
        providerEntityId: 'job-1',
        externalObjectId: null,
        processingLogId: 'log-1',
        eventType: 'JOB_UPDATED',
      });

      expect(result).toEqual({ route: 'more0', ok: true });
      expect(more0.invokeViaGateway).toHaveBeenCalledWith(
        expect.objectContaining({
          cap: expect.stringContaining('process-inbound-event'),
          method: 'execute',
          params: { eventId: 'evt-1' },
        }),
      );
      expect(processingLogRepo.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log-1',
          status: 'processing',
          workflowRunId: 'run-abc',
        }),
      );
      expect(webhookRepo.updateProcessingStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-1',
          processingStatus: 'dispatched',
        }),
      );
    });

    it('on gateway failure flips log to workflow_invoke_failed and event to dispatch_failed', async () => {
      const { service, more0, processingLogRepo, webhookRepo } = buildDeps({
        'webhook.processingMode': 'more0',
        'more0.enabled': true,
        'more0.apiKey': 'k',
      });
      (more0.invokeViaGateway as jest.Mock).mockRejectedValue(
        new Error('boom'),
      );

      const result = await service.finalize({
        eventId: 'evt-1',
        tenantId: 't-1',
        connectionId: 'c-1',
        providerEntityType: 'job',
        providerEntityId: 'job-1',
        externalObjectId: null,
        processingLogId: 'log-1',
        eventType: 'JOB_UPDATED',
      });

      expect(result.ok).toBe(false);
      expect(processingLogRepo.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log-1',
          status: 'workflow_invoke_failed',
          errorMessage: 'boom',
        }),
      );
      expect(webhookRepo.updateProcessingStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-1',
          processingStatus: 'dispatch_failed',
        }),
      );
    });
  });

  describe('finalize on inproc route', () => {
    it('fails fast when externalObjectId missing', async () => {
      const { service, processingLogRepo } = buildDeps({
        'webhook.processingMode': 'inproc',
      });

      const result = await service.finalize({
        eventId: 'evt-1',
        tenantId: 't-1',
        connectionId: 'c-1',
        providerEntityType: 'job',
        providerEntityId: 'job-1',
        externalObjectId: null,
        processingLogId: 'log-1',
        eventType: 'JOB_UPDATED',
      });

      expect(result).toEqual({
        route: 'inproc',
        ok: false,
        reason: 'missing_external_object',
      });
      expect(processingLogRepo.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log-1',
          status: 'failed',
        }),
      );
    });
  });
});
