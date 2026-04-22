import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import {
  ExternalObjectsRepository,
  ExternalProcessingLogRepository,
} from '../../../database/repositories';
import { EntityMapperRegistry } from '../../external/entity-mapper.registry';
import { ToolAuthGuard } from '../tool-auth.guard';

/**
 * HTTP endpoint that backs `tool.claims-manager-webhook.entity-mapper`.
 * Called from the sandboxed inline-ts tool module
 * `apps/api/more0/definitions/tools/entity-mapper/entity-mapper.ts`.
 */
@Controller('api/v1/webhook-tools/mappers')
@Public()
@UseGuards(ToolAuthGuard)
export class EntityMapperController {
  private readonly logger = new Logger('EntityMapperController');

  constructor(
    private readonly mapperRegistry: EntityMapperRegistry,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
  ) {}

  @Post(':entityType')
  @HttpCode(HttpStatus.OK)
  async map(
    @Param('entityType') entityType: string,
    @Body()
    body: {
      externalObjectId: string;
      tenantId: string;
      connectionId: string;
      processingLogId?: string;
    },
  ): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }> {
    const logPrefix = 'EntityMapperController.map';
    this.logger.log(
      `${logPrefix} — entityType=${entityType} externalObjectId=${body.externalObjectId} processingLogId=${body.processingLogId ?? 'none'}`,
    );

    const mapper = this.mapperRegistry.get({ entityType });
    if (!mapper) {
      throw new BadRequestException(
        `${logPrefix} — no mapper registered for entity type: ${entityType}`,
      );
    }

    const externalObject = await this.externalObjectsRepo.findById({
      id: body.externalObjectId,
    });
    if (!externalObject) {
      throw new BadRequestException(
        `${logPrefix} — external object not found: ${body.externalObjectId}`,
      );
    }

    const result = await mapper.map({
      externalObject: externalObject as unknown as Record<string, unknown>,
      tenantId: body.tenantId,
      connectionId: body.connectionId,
    });

    if (body.processingLogId) {
      await this.processingLogRepo.updateStatus({
        id: body.processingLogId,
        status: 'completed',
        completedAt: new Date(),
        externalObjectId: body.externalObjectId,
      });
    }

    return result;
  }
}
