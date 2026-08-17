import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
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
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { UseCaseRegistry } from '../../domain/use-cases/use-case.registry';
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
    private readonly useCaseRegistry: UseCaseRegistry,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
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

    const useCase = this.useCaseRegistry.get(entityType);
    if (!useCase) {
      throw new BadRequestException(
        `${logPrefix} — no use case registered for entity type: ${entityType}`,
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

    const result = await this.db.transaction(async (tx) => {
      return useCase.execute({
        externalObject: externalObject as unknown as Record<string, unknown>,
        tenantId: body.tenantId,
        connectionId: body.connectionId,
        tx,
      });
    });

    if (body.processingLogId && result.status === 'completed') {
      await this.processingLogRepo.updateStatus({
        id: body.processingLogId,
        status: 'completed',
        completedAt: new Date(),
        externalObjectId: body.externalObjectId,
      });
    }

    return {
      internalEntityId: result.internalEntityId,
      internalEntityType: result.internalEntityType,
      skipped: result.status === 'skipped' ? result.reason : undefined,
    };
  }
}
