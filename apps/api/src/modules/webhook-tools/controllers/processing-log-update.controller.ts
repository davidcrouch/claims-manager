import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import {
  ExternalProcessingLogRepository,
  InboundWebhookEventsRepository,
} from '../../../database/repositories';
import { ToolAuthGuard } from '../tool-auth.guard';

/**
 * HTTP endpoint that backs `tool.claims-manager-webhook.processing-log-update`.
 * Called from the sandboxed inline-ts tool module
 * `apps/api/more0/definitions/tools/processing-log-update/processing-log-update.ts`.
 */
@Controller('api/v1/webhook-tools/processing-log')
@Public()
@UseGuards(ToolAuthGuard)
export class ProcessingLogUpdateController {
  private readonly logger = new Logger('ProcessingLogUpdateController');

  constructor(
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
  ) {}

  @Post('update')
  @HttpCode(HttpStatus.OK)
  async update(
    @Body()
    body: {
      processingLogId?: string | null;
      status: string;
      externalObjectId?: string;
      errorMessage?: string;
      eventId?: string;
      eventStatus?: string;
    },
  ): Promise<{ success: boolean }> {
    const logPrefix = 'ProcessingLogUpdateController.update';
    this.logger.log(
      `${logPrefix} — id=${body.processingLogId ?? 'none'} status=${body.status} eventId=${body.eventId ?? 'none'} eventStatus=${body.eventStatus ?? 'none'}`,
    );

    if (body.processingLogId) {
      await this.processingLogRepo.updateStatus({
        id: body.processingLogId,
        status: body.status,
        completedAt:
          body.status === 'completed' || body.status === 'failed'
            ? new Date()
            : undefined,
        externalObjectId: body.externalObjectId,
        errorMessage: body.errorMessage,
      });
    }

    if (body.eventId && body.eventStatus) {
      await this.webhookRepo.updateProcessingStatus({
        id: body.eventId,
        processingStatus: body.eventStatus,
        processingError: body.errorMessage ?? null,
      });
    }

    return { success: true };
  }
}
