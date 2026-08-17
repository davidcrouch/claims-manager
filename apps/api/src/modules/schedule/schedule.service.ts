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
    /** When set, only events assigned to this user (or on a job assigned to them). */
    assignedToUserId?: string;
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

    const userId = params.assignedToUserId?.trim();
    const assignedFilter = userId
      ? sql`AND (
          -- Direct assignees
          (event_type = 'task' AND EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = schedule_events.id AND t.assigned_to_user_id = ${userId}
          ))
          OR (event_type = 'job' AND EXISTS (
            SELECT 1 FROM jobs j
            WHERE j.id = schedule_events.id AND j.assigned_to_user_id = ${userId}
          ))
          OR (event_type = 'quote' AND EXISTS (
            SELECT 1 FROM quotes q
            WHERE q.id = schedule_events.id AND q.assigned_to_user_id = ${userId}
          ))
          OR (event_type = 'message' AND EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = schedule_events.id AND m.to_user_id = ${userId}
          ))
          OR (event_type = 'claim' AND EXISTS (
            SELECT 1 FROM claim_assignees ca
            WHERE ca.claim_id = schedule_events.id AND ca.user_id = ${userId}
          ))
          OR (event_type = 'appointment' AND EXISTS (
            SELECT 1 FROM appointment_attendees aa
            WHERE aa.appointment_id = schedule_events.id AND aa.user_id = ${userId}
          ))
          -- Job-linked work assigned to the user
          OR (
            job_id IS NOT NULL
            AND event_type IN (
              'appointment', 'work_order', 'invoice', 'assessment',
              'rfq', 'proposal', 'purchase_order', 'bill', 'task', 'quote', 'message'
            )
            AND EXISTS (
              SELECT 1 FROM jobs j
              WHERE j.id = schedule_events.job_id AND j.assigned_to_user_id = ${userId}
            )
          )
          -- Claim-linked work where the user is a claim assignee
          OR (
            claim_id IS NOT NULL
            AND event_type IN (
              'task', 'job', 'quote', 'work_order', 'invoice', 'message',
              'rfq', 'proposal', 'purchase_order', 'bill'
            )
            AND EXISTS (
              SELECT 1 FROM claim_assignees ca
              WHERE ca.claim_id = schedule_events.claim_id AND ca.user_id = ${userId}
            )
          )
        )`
      : sql``;

    if (userId) {
      this.logger.debug(
        `ScheduleService.findEvents — mine filter userId=${userId} from=${params.from} to=${params.to}`,
      );
    }

    const result = await this.db.execute<ScheduleEventRow>(sql`
      SELECT id, tenant_id, event_type, title, starts_at, ends_at, status, priority, job_id, claim_id
      FROM schedule_events
      WHERE tenant_id = ${tenantId}::uuid
        AND starts_at >= ${params.from}::timestamptz
        AND starts_at < ${params.to}::timestamptz
        ${eventTypeFilter}
        ${jobIdFilter}
        ${assignedFilter}
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
