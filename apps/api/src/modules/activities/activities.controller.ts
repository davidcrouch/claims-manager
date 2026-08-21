import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { TenantContext } from '../../tenant/tenant-context';

@Controller('activities')
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async list(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.activitiesService.list({
      tenantId,
      entityType,
      entityId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    this.logger.debug(
      `ActivitiesController.list — entityType=${entityType} entityId=${entityId} total=${result.total}`,
    );
    return result;
  }

  @Get('related')
  @RequirePermission(P.procurement.read)
  async listByRelated(
    @Query('relatedEntityType') relatedEntityType: string,
    @Query('relatedEntityId') relatedEntityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.activitiesService.listByRelated({
      tenantId,
      relatedEntityType,
      relatedEntityId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
