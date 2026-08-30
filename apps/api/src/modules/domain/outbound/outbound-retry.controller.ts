import { Controller, Post, Param, BadRequestException, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { tasks, appointments, quotes, invoices, jobs } from '../../../database/schema';
import { TenantContext } from '../../../tenant/tenant-context';
import { OutboundSyncService } from './outbound-sync.service';
import { RequirePermission } from '../../../auth/decorators/require-permission.decorator';
import { P } from '../../../auth/permission-constants';

const ENTITY_TABLES: Record<string, { table: any; idCol: any; syncStatusCol: string }> = {
  task: { table: tasks, idCol: tasks.id, syncStatusCol: 'syncStatus' },
  appointment: { table: appointments, idCol: appointments.id, syncStatusCol: 'syncStatus' },
  quote: { table: quotes, idCol: quotes.id, syncStatusCol: 'syncStatus' },
  invoice: { table: invoices, idCol: invoices.id, syncStatusCol: 'syncStatus' },
  job: { table: jobs, idCol: jobs.id, syncStatusCol: 'syncStatus' },
};

@Controller('outbound-sync')
export class OutboundRetryController {
  private readonly logger = new Logger('OutboundRetryController');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tenantContext: TenantContext,
    private readonly outboundSync: OutboundSyncService,
  ) {}

  @Post(':entityType/:entityId/retry')
  @RequirePermission(P.workflows.manage)
  async retry(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const config = ENTITY_TABLES[entityType];
    if (!config) {
      throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }

    const [entity] = await this.db
      .select()
      .from(config.table)
      .where(eq(config.idCol, entityId))
      .limit(1);

    if (!entity) {
      throw new BadRequestException(`${entityType} not found: ${entityId}`);
    }

    if (entity.syncStatus !== 'failed') {
      throw new BadRequestException(`${entityType} sync status is '${entity.syncStatus}', not 'failed'`);
    }

    await this.db
      .update(config.table)
      .set({ syncStatus: 'pending', updatedAt: new Date() })
      .where(eq(config.idCol, entityId));

    const queueId = await this.outboundSync.enqueueIfConnected({
      tenantId,
      entityType,
      entityId,
      action: 'update',
      payload: entity as Record<string, unknown>,
      sourceEvent: 'api:retry',
      tx: this.db,
    });

    this.logger.log(
      `OutboundRetryController — re-enqueued ${entityType}:${entityId} queueId=${queueId}`,
    );

    return { success: true, syncStatus: 'pending', queueId };
  }
}
