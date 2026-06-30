import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';

type ScheduleEventRow = {
  id: string;
  tenant_id: string;
  event_type: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  priority: string | null;
  job_id: string | null;
  claim_id: string | null;
  [key: string]: unknown;
};

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tenantContext: TenantContext,
  ) {}

  async findEvents(params: {
    from: string;
    to: string;
    eventType?: string[];
    jobId?: string;
    limit?: number;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const limit = Math.min(params.limit ?? 500, 2000);

    const eventTypeFilter =
      params.eventType && params.eventType.length > 0
        ? sql`AND event_type = ANY(${params.eventType})`
        : sql``;

    const jobIdFilter = params.jobId
      ? sql`AND job_id = ${params.jobId}::uuid`
      : sql``;

    const result = await this.db.execute<ScheduleEventRow>(sql`
      SELECT id, tenant_id, event_type, title, starts_at, ends_at, status, priority, job_id, claim_id
      FROM schedule_events
      WHERE tenant_id = ${tenantId}::uuid
        AND starts_at >= ${params.from}::timestamptz
        AND starts_at < ${params.to}::timestamptz
        ${eventTypeFilter}
        ${jobIdFilter}
      ORDER BY starts_at ASC
      LIMIT ${limit}
    `);

    const data = (result as unknown as { rows: ScheduleEventRow[] }).rows ?? [];
    return {
      data: data.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        eventType: r.event_type,
        title: r.title,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.status,
        priority: r.priority,
        jobId: r.job_id,
        claimId: r.claim_id,
      })),
      total: data.length,
    };
  }
}
