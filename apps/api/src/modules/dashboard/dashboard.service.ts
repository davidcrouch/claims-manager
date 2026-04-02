import { Injectable } from '@nestjs/common';
import {
  ClaimsRepository,
  JobsRepository,
  QuotesRepository,
  InvoicesRepository,
  TasksRepository,
  InboundWebhookEventsRepository,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

export interface DashboardStatsDto {
  totalClaims: number;
  totalJobs: number;
  jobsByStatus: { status: string; count: string }[];
  pendingApprovals: number;
  openInvoices: number;
  openTasks: number;
  recentJobCount: number;
}

export interface RecentActivityDto {
  id: string;
  type: string;
  entityId: string;
  timestamp: Date;
  description: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly claimsRepo: ClaimsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly quotesRepo: QuotesRepository,
    private readonly invoicesRepo: InvoicesRepository,
    private readonly tasksRepo: TasksRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async getStats(): Promise<DashboardStatsDto> {
    const tenantId = this.tenantContext.getTenantId();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalClaims,
      totalJobs,
      jobsByStatus,
      pendingApprovals,
      openInvoices,
      openTasks,
      recentJobCount,
    ] = await Promise.all([
      this.claimsRepo.countByTenant({ tenantId }),
      this.jobsRepo.countByTenant({ tenantId }),
      this.jobsRepo.countByStatusGrouped({ tenantId }),
      this.quotesRepo.countByTenant({ tenantId }),
      this.invoicesRepo.countByTenantAndDeleted({ tenantId, isDeleted: false }),
      this.tasksRepo.countByTenantAndStatus({ tenantId, status: 'Open' }),
      this.jobsRepo.countByTenantSince({ tenantId, since: sevenDaysAgo }),
    ]);

    return {
      totalClaims,
      totalJobs,
      jobsByStatus,
      pendingApprovals,
      openInvoices,
      openTasks,
      recentJobCount,
    };
  }

  async getRecentActivity(params: { limit?: number }): Promise<RecentActivityDto[]> {
    const tenantId = this.tenantContext.getTenantId();
    const events = await this.webhookRepo.findRecentProcessed({
      tenantId,
      limit: params.limit ?? 20,
    });

    return events.map((event) => ({
      id: event.id,
      type: event.eventType,
      entityId: event.payloadEntityId ?? '',
      timestamp: event.eventTimestamp,
      description: `${event.eventType} - ${event.payloadEntityId ?? 'unknown'}`,
    }));
  }
}
