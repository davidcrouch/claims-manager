import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ExternalProcessingLogRepository,
  ExternalObjectsRepository,
  ExternalObjectVersionsRepository,
  ExternalLinksRepository,
  ExternalEventAttemptsRepository,
  InboundWebhookEventsRepository,
} from '../../database/repositories';
import { More0Service } from '../../more0/more0.service';

@Controller('api/v1/external')
export class ExternalController {
  private readonly logger = new Logger('ExternalController');

  constructor(
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly externalObjectVersionsRepo: ExternalObjectVersionsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly eventAttemptsRepo: ExternalEventAttemptsRepository,
    private readonly webhookEventsRepo: InboundWebhookEventsRepository,
    private readonly more0Service: More0Service,
  ) {}

  @Get('processing-log')
  async listProcessingLog(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('providerEntityType') providerEntityType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.processingLogRepo.findByTenantAndType({
      tenantId,
      providerEntityType,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('processing-log/:id')
  async getProcessingLogEntry(
    @Param('id') id: string,
  ) {
    const logEntry = await this.processingLogRepo.findByEventId({ eventId: id });
    const attempts = logEntry
      ? await this.eventAttemptsRepo.findByEventId({ eventId: logEntry.eventId ?? '' })
      : [];
    return { logEntry, attempts };
  }

  @Get('objects')
  async listExternalObjects(
    @Query('tenantId') tenantId: string,
    @Query('normalizedEntityType') normalizedEntityType: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalObjectsRepo.findByTenantAndType({
      tenantId,
      normalizedEntityType,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('objects/:id')
  async getExternalObject(@Param('id') id: string) {
    const obj = await this.externalObjectsRepo.findById({ id });
    if (!obj) return { object: null, versions: [], links: [] };

    const [versions, links] = await Promise.all([
      this.externalObjectVersionsRepo.findByExternalObjectId({
        externalObjectId: id,
      }),
      this.externalLinksRepo.findByExternalObjectId({
        externalObjectId: id,
      }),
    ]);

    return { object: obj, versions, links };
  }

  @Get('objects/:id/versions')
  async getExternalObjectVersions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalObjectVersionsRepo.findByExternalObjectId({
      externalObjectId: id,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('links')
  async listExternalLinks(
    @Query('internalEntityType') internalEntityType: string,
    @Query('internalEntityId') internalEntityId: string,
  ) {
    return this.externalLinksRepo.findByInternalEntity({
      internalEntityType,
      internalEntityId,
    });
  }

  @Get('events')
  async listEvents(
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookEventsRepo.findRecentProcessed({
      tenantId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('summary')
  async getSummary(@Query('tenantId') tenantId: string) {
    const [pending, completed, failed, objects] = await Promise.all([
      this.processingLogRepo.findByTenantAndType({
        tenantId,
        status: 'pending',
        limit: 1,
      }),
      this.processingLogRepo.findByTenantAndType({
        tenantId,
        status: 'completed',
        limit: 1,
      }),
      this.processingLogRepo.findByTenantAndType({
        tenantId,
        status: 'failed',
        limit: 1,
      }),
      this.externalObjectsRepo.findByTenantAndType({
        tenantId,
        normalizedEntityType: '%',
        limit: 1,
      }),
    ]);

    return {
      pendingProcessing: pending.total,
      completedProcessing: completed.total,
      failedProcessing: failed.total,
      externalObjectCount: objects.total,
    };
  }

  @Post('backfill')
  @HttpCode(HttpStatus.OK)
  async triggerBackfill(
    @Body()
    body: {
      tenantId: string;
      connectionId: string;
      providerEntityType: string;
      providerEntityId: string;
    },
  ) {
    this.logger.log(
      `ExternalController.triggerBackfill — ${body.providerEntityType}/${body.providerEntityId}`,
    );

    const logEntry = await this.processingLogRepo.create({
      data: {
        tenantId: body.tenantId,
        connectionId: body.connectionId,
        providerEntityType: body.providerEntityType,
        providerEntityId: body.providerEntityId,
        action: 'backfill',
        status: 'pending',
      },
    });

    try {
      const { runId } = await this.more0Service.invokeWorkflow({
        workflowName: 'process-webhook-event',
        input: {
          eventId: null,
          tenantId: body.tenantId,
          connectionId: body.connectionId,
          eventType: `BACKFILL_${body.providerEntityType.toUpperCase()}`,
          providerEntityId: body.providerEntityId,
          processingLogId: logEntry.id,
        },
        context: { tenantId: body.tenantId },
      });

      await this.processingLogRepo.updateStatus({
        id: logEntry.id,
        status: 'processing',
        workflowRunId: runId,
      });

      return { processingLogId: logEntry.id, workflowRunId: runId };
    } catch (error) {
      const err = error as Error;
      await this.processingLogRepo.updateStatus({
        id: logEntry.id,
        status: 'workflow_invoke_failed',
        errorMessage: err.message,
      });
      return { processingLogId: logEntry.id, workflowRunId: null, error: err.message };
    }
  }

  @Post('backfill/bulk')
  @HttpCode(HttpStatus.OK)
  async triggerBulkBackfill(
    @Body()
    body: {
      tenantId: string;
      connectionId: string;
      providerEntityType: string;
      providerEntityIds: string[];
    },
  ) {
    this.logger.log(
      `ExternalController.triggerBulkBackfill — ${body.providerEntityType} x ${body.providerEntityIds.length}`,
    );

    let invoked = 0;
    let failed = 0;

    for (const providerEntityId of body.providerEntityIds) {
      try {
        const logEntry = await this.processingLogRepo.create({
          data: {
            tenantId: body.tenantId,
            connectionId: body.connectionId,
            providerEntityType: body.providerEntityType,
            providerEntityId,
            action: 'backfill',
            status: 'pending',
          },
        });

        const { runId } = await this.more0Service.invokeWorkflow({
          workflowName: 'process-webhook-event',
          input: {
            eventId: null,
            tenantId: body.tenantId,
            connectionId: body.connectionId,
            eventType: `BACKFILL_${body.providerEntityType.toUpperCase()}`,
            providerEntityId,
            processingLogId: logEntry.id,
          },
          context: { tenantId: body.tenantId },
        });

        await this.processingLogRepo.updateStatus({
          id: logEntry.id,
          status: 'processing',
          workflowRunId: runId,
        });

        invoked++;
      } catch {
        failed++;
      }
    }

    return { invoked, failed, total: body.providerEntityIds.length };
  }
}
