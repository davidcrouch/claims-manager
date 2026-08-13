import { Injectable, Logger } from '@nestjs/common';
import {
  ClaimsRepository,
  JobsRepository,
  QuotesRepository,
  InvoicesRepository,
  TasksRepository,
  InboundWebhookEventsRepository,
  LookupsRepository,
  WorkOrdersRepository,
  RfqsRepository,
  ProposalsRepository,
  NotificationsRepository,
  ClaimAssigneesRepository,
  type TaskRow,
  type TaskViewRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { FinanceService } from '../finance/finance.service';
import { ScheduleService } from '../schedule/schedule.service';
import {
  ESTIMATE_PUBLISH_STATUS_NAMES,
  PROPOSAL_REVIEW_STATUS_NAMES,
  RFQ_AWAITING_STATUS_NAMES,
  WO_ACCEPT_STATUS_NAMES,
  daysFromNow,
  formatJobAddressLine,
  humanizeTitle,
  inactiveJobStatusIds,
  jobSubtitle,
  matchLookupIdsByNames,
  notificationHref,
  overdueCountFromBuckets,
  scheduleEventHref,
  shouldIncludeMyTasks,
  statusFilterHref,
  utcDayBounds,
} from './dashboard.utils';

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

export type InboxQueueKey =
  | 'workOrdersToAccept'
  | 'proposalsToReview'
  | 'rfqsAwaiting'
  | 'estimatesToPublish'
  | 'overdueTasks'
  | 'myTasks'
  | 'overdueInvoices'
  | 'overdueBills';

export interface DashboardInboxItem {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  status?: string;
  dueAt?: string | null;
  href: string;
  jobId?: string | null;
}

export interface DashboardActiveJobItem {
  id: string;
  title: string;
  status?: string;
  jobType?: string;
  address?: string;
  requestDate?: string | null;
  updatedAt?: string | null;
  unread: boolean;
  href: string;
}

export interface DashboardInboxQueue {
  key: InboxQueueKey;
  title: string;
  count: number;
  href: string;
  items: DashboardInboxItem[];
}

export interface DashboardInboxDto {
  generatedAt: string;
  snapshot: {
    activeJobs: number;
    unreadCount: number;
    unreadJobCount: number;
    arOverdueCount: number;
    apOverdueCount: number;
    arTotalOverdue: number;
    apTotalOverdue: number;
    actionRequired: number;
  };
  queues: DashboardInboxQueue[];
  today: DashboardInboxItem[];
  unread: DashboardInboxItem[];
  activeJobs: {
    scopedToUser: boolean;
    count: number;
    href: string;
    items: DashboardActiveJobItem[];
    mine: {
      count: number;
      href: string;
      items: DashboardActiveJobItem[];
    };
  };
}

const PREVIEW_LIMIT = 5;
const TODAY_LIMIT = 12;
const UNREAD_LIMIT = 8;
const ACTIVE_JOBS_LIMIT = 12;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly claimsRepo: ClaimsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly quotesRepo: QuotesRepository,
    private readonly invoicesRepo: InvoicesRepository,
    private readonly tasksRepo: TasksRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly rfqsRepo: RfqsRepository,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly notificationsRepo: NotificationsRepository,
    private readonly claimAssigneesRepo: ClaimAssigneesRepository,
    private readonly financeService: FinanceService,
    private readonly scheduleService: ScheduleService,
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

  async getInbox(params: {
    userId?: string | null;
    email?: string | null;
  }): Promise<DashboardInboxDto> {
    const tenantId = this.tenantContext.getTenantId();
    const userId = params.userId?.trim() || null;
    const email = params.email?.trim() || null;
    this.logger.log(
      `dashboard:DashboardService.getInbox - tenantId=${tenantId} userId=${userId ? 'set' : 'none'}`,
    );

    const [
      woLookups,
      proposalLookups,
      rfqLookups,
      quoteLookups,
      jobStatusLookups,
      assignedClaimIds,
    ] = await Promise.all([
      this.lookupsRepo.findByDomain({ tenantId, domain: 'work_order_status' }),
      this.lookupsRepo.findByDomain({ tenantId, domain: 'proposal_status' }),
      this.lookupsRepo.findByDomain({ tenantId, domain: 'rfq_status' }),
      this.lookupsRepo.findByDomain({ tenantId, domain: 'quote_status' }),
      this.lookupsRepo.findByDomain({ tenantId, domain: 'job_status' }),
      this.claimAssigneesRepo.findClaimIdsByAssignee({ tenantId, userId, email }),
    ]);

    const excludeJobStatusIds = inactiveJobStatusIds(jobStatusLookups);
    const hasMineScope = Boolean(userId) || assignedClaimIds.length > 0;
    const assignedActiveJobs = hasMineScope
      ? await this.jobsRepo.findActiveForInbox({
          tenantId,
          excludeStatusIds: excludeJobStatusIds,
          claimIds: assignedClaimIds,
          assignedToUserId: userId ?? undefined,
          limit: ACTIVE_JOBS_LIMIT,
        })
      : { data: [], total: 0 };
    const scopedToUser = assignedActiveJobs.total > 0;

    const woStatusIds = matchLookupIdsByNames(woLookups, WO_ACCEPT_STATUS_NAMES);
    const proposalStatusIds = matchLookupIdsByNames(
      proposalLookups,
      PROPOSAL_REVIEW_STATUS_NAMES,
    );
    const rfqStatusIds = matchLookupIdsByNames(rfqLookups, RFQ_AWAITING_STATUS_NAMES);
    const quoteStatusIds = matchLookupIdsByNames(
      quoteLookups,
      ESTIMATE_PUBLISH_STATUS_NAMES,
    );

    const day = utcDayBounds();
    const dueSoonUntil = daysFromNow(7);

    const [
      workOrders,
      proposals,
      rfqs,
      quotes,
      overdueTasks,
      openTasks,
      myTasks,
      finance,
      unreadNotifications,
      unreadCount,
      unreadJobIds,
      todayEvents,
      tenantActiveJobs,
    ] = await Promise.all([
      woStatusIds.length > 0
        ? this.workOrdersRepo.findAll({
            tenantId,
            status: woStatusIds.join(','),
            limit: PREVIEW_LIMIT,
            sort: 'updated_at_desc',
          })
        : { data: [], total: 0 },
      proposalStatusIds.length > 0
        ? this.proposalsRepo.findAll({
            tenantId,
            status: proposalStatusIds.join(','),
            limit: PREVIEW_LIMIT,
            sort: 'updated_at_desc',
          })
        : { data: [], total: 0 },
      rfqStatusIds.length > 0
        ? this.rfqsRepo.findAll({
            tenantId,
            status: rfqStatusIds.join(','),
            limit: PREVIEW_LIMIT,
            sort: 'due_date_asc',
          })
        : { data: [], total: 0 },
      quoteStatusIds.length > 0
        ? this.quotesRepo.findAll({
            tenantId,
            status: quoteStatusIds.join(','),
            limit: PREVIEW_LIMIT,
            sort: 'updated_at_desc',
          })
        : { data: [], total: 0 },
      this.tasksRepo.findOverdue({ tenantId }),
      this.tasksRepo.findAll({
        tenantId,
        status: 'Open',
        sort: 'due_date_asc',
        limit: 50,
      }),
      userId
        ? this.tasksRepo.findAll({
            tenantId,
            status: 'Open',
            assignedToUserId: userId,
            sort: 'due_date_asc',
            limit: PREVIEW_LIMIT,
          })
        : Promise.resolve({ data: [] as TaskViewRow[], total: 0 }),
      this.financeService.getSummary(),
      this.notificationsRepo.findUnreadByTenant({ tenantId, limit: UNREAD_LIMIT }),
      this.notificationsRepo.countUnreadByTenant({ tenantId }),
      this.notificationsRepo.getUnreadEntityIds({ tenantId, entityType: 'job' }),
      this.scheduleService.findEvents({
        from: day.from,
        to: day.to,
        limit: TODAY_LIMIT,
      }),
      this.jobsRepo.findActiveForInbox({
        tenantId,
        excludeStatusIds: excludeJobStatusIds,
        limit: ACTIVE_JOBS_LIMIT,
      }),
    ]);

    const activeJobRows = tenantActiveJobs;

    const now = new Date();
    const dueSoon = openTasks.data.filter((task) => {
      if (!task.dueDate) return false;
      const due = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      return due >= now && due <= dueSoonUntil;
    });
    const overdueAndSoon = this.dedupeTasks([...overdueTasks, ...dueSoon]);

    const jobIds = new Set<string>();
    for (const row of workOrders.data) if (row.jobId) jobIds.add(row.jobId);
    for (const row of proposals.data) if (row.jobId) jobIds.add(row.jobId);
    for (const row of rfqs.data) if (row.jobId) jobIds.add(row.jobId);
    for (const row of quotes.data) if (row.jobId) jobIds.add(row.jobId);
    for (const task of overdueAndSoon) if (task.jobId) jobIds.add(task.jobId);
    for (const task of myTasks.data) if (task.jobId) jobIds.add(task.jobId);
    for (const event of todayEvents.data) if (event.jobId) jobIds.add(event.jobId);

    const jobs = await this.jobsRepo.findByIds({ tenantId, ids: [...jobIds] });
    const jobById = new Map(jobs.map((job) => [job.id, job]));

    const lookupName = (lookups: Array<{ id: string; name: string | null }>, id?: string | null) =>
      id ? lookups.find((l) => l.id === id)?.name ?? undefined : undefined;

    const queues: DashboardInboxQueue[] = [];

    if (workOrders.total > 0) {
      queues.push({
        key: 'workOrdersToAccept',
        title: 'Work orders to accept',
        count: workOrders.total,
        href: statusFilterHref('/work-orders', woStatusIds),
        items: workOrders.data.map((row) => ({
          id: row.id,
          entityType: 'work_order',
          title: humanizeTitle('Work order', row.workOrderNumber, row.name),
          subtitle: jobSubtitle(jobById.get(row.jobId ?? '')),
          status: lookupName(woLookups, row.statusLookupId),
          dueAt: row.startDate ?? null,
          href: `/work-orders/${row.id}`,
          jobId: row.jobId,
        })),
      });
    }

    if (proposals.total > 0) {
      queues.push({
        key: 'proposalsToReview',
        title: 'Proposals to review',
        count: proposals.total,
        href: statusFilterHref('/proposals', proposalStatusIds),
        items: proposals.data.map((row) => ({
          id: row.id,
          entityType: 'proposal',
          title: humanizeTitle('Proposal', row.proposalNumber, row.name, row.reference),
          subtitle: jobSubtitle(jobById.get(row.jobId ?? '')) ?? row.proposalToName ?? undefined,
          status: lookupName(proposalLookups, row.statusLookupId),
          dueAt: row.receivedDate ? new Date(row.receivedDate).toISOString() : null,
          href: `/proposals/${row.id}`,
          jobId: row.jobId,
        })),
      });
    }

    if (rfqs.total > 0) {
      queues.push({
        key: 'rfqsAwaiting',
        title: 'RFQs waiting on vendors',
        count: rfqs.total,
        href: statusFilterHref('/rfqs', rfqStatusIds),
        items: rfqs.data.map((row) => ({
          id: row.id,
          entityType: 'rfq',
          title: humanizeTitle('RFQ', row.rfqNumber, row.name),
          subtitle: jobSubtitle(jobById.get(row.jobId ?? '')) ?? row.rfqToName ?? undefined,
          status: lookupName(rfqLookups, row.statusLookupId),
          dueAt: row.dueDate ? new Date(row.dueDate).toISOString() : null,
          href: `/rfqs/${row.id}`,
          jobId: row.jobId,
        })),
      });
    }

    if (quotes.total > 0) {
      queues.push({
        key: 'estimatesToPublish',
        title: 'Estimates ready to publish',
        count: quotes.total,
        href: statusFilterHref('/quotes', quoteStatusIds),
        items: quotes.data.map((row) => ({
          id: row.id,
          entityType: 'quote',
          title: humanizeTitle('Estimate', row.quoteNumber, row.name, row.reference),
          subtitle: jobSubtitle(jobById.get(row.jobId ?? '')),
          status: row.statusName ?? lookupName(quoteLookups, row.statusLookupId),
          dueAt: row.quoteDate ? new Date(row.quoteDate).toISOString() : null,
          href: `/quotes/${row.id}`,
          jobId: row.jobId,
        })),
      });
    }

    if (overdueAndSoon.length > 0) {
      queues.push({
        key: 'overdueTasks',
        title: 'Overdue / due soon',
        count: overdueAndSoon.length,
        href: '/tasks?status=Open&overdue=true',
        items: overdueAndSoon.slice(0, PREVIEW_LIMIT).map((task) => this.taskItem(task, jobById)),
      });
    }

    if (userId && shouldIncludeMyTasks(userId, myTasks.total)) {
      queues.push({
        key: 'myTasks',
        title: 'My tasks',
        count: myTasks.total,
        href: `/tasks?status=Open&assignedToUserId=${encodeURIComponent(userId)}`,
        items: myTasks.data.map((task) => this.taskItem(task, jobById)),
      });
    }

    const arOverdueCount = overdueCountFromBuckets(finance.ar.buckets);
    const apOverdueCount = overdueCountFromBuckets(finance.ap.buckets);

    if (arOverdueCount > 0) {
      queues.push({
        key: 'overdueInvoices',
        title: 'Overdue invoices',
        count: arOverdueCount,
        href: '/finance/ar',
        items: [],
      });
    }

    if (apOverdueCount > 0) {
      queues.push({
        key: 'overdueBills',
        title: 'Overdue bills',
        count: apOverdueCount,
        href: '/finance/ap',
        items: [],
      });
    }

    const today: DashboardInboxItem[] = todayEvents.data.map((event) => ({
      id: event.id,
      entityType: event.eventType,
      title: humanizeTitle('Scheduled item', event.title),
      subtitle: jobSubtitle(jobById.get(event.jobId ?? '')),
      status: event.status ?? undefined,
      dueAt: event.startsAt,
      href: scheduleEventHref(event.eventType, event.id),
      jobId: event.jobId,
    }));

    const unread: DashboardInboxItem[] = unreadNotifications.map((n) => ({
      id: n.id,
      entityType: n.entityType,
      title: humanizeTitle('Notification', n.title),
      subtitle: undefined,
      dueAt: n.createdAt ? new Date(n.createdAt).toISOString() : null,
      href: notificationHref(n.entityType, n.entityId),
      jobId: n.entityType === 'job' ? n.entityId : null,
    }));

    const unreadJobSet = new Set(unreadJobIds);
    const toActiveJobItem = (
      job: (typeof activeJobRows.data)[number],
    ): DashboardActiveJobItem => ({
      id: job.id,
      title: humanizeTitle(
        'Job',
        job.name,
        job.externalReference,
        job.externalJobId,
      ),
      status: job.statusName ?? undefined,
      jobType: job.jobTypeName ?? undefined,
      address: formatJobAddressLine(job),
      requestDate: job.requestDate ?? null,
      updatedAt: job.updatedAt ? new Date(job.updatedAt).toISOString() : null,
      unread: unreadJobSet.has(job.id),
      href: `/jobs/${job.id}`,
    });
    const activeJobItems = activeJobRows.data.map(toActiveJobItem);
    const myJobItems = assignedActiveJobs.data.map(toActiveJobItem);
    const myJobsHref = userId
      ? `/jobs?assignedToUserId=${encodeURIComponent(userId)}`
      : '/jobs';

    const actionRequired = queues
      .filter((q) =>
        ['workOrdersToAccept', 'proposalsToReview', 'rfqsAwaiting', 'estimatesToPublish', 'overdueTasks'].includes(
          q.key,
        ),
      )
      .reduce((sum, q) => sum + q.count, 0);

    return {
      generatedAt: new Date().toISOString(),
      snapshot: {
        activeJobs: activeJobRows.total,
        unreadCount,
        unreadJobCount: unreadJobIds.length,
        arOverdueCount,
        apOverdueCount,
        arTotalOverdue: finance.ar.totalOverdue,
        apTotalOverdue: finance.ap.totalOverdue,
        actionRequired,
      },
      queues,
      today,
      unread,
      activeJobs: {
        scopedToUser,
        count: activeJobRows.total,
        href: '/jobs',
        items: activeJobItems,
        mine: {
          count: assignedActiveJobs.total,
          href: myJobsHref,
          items: myJobItems,
        },
      },
    };
  }

  private taskItem(
    task: TaskRow,
    jobById: Map<string, { externalReference?: string | null; name?: string | null }>,
  ): DashboardInboxItem {
    return {
      id: task.id,
      entityType: 'task',
      title: humanizeTitle('Task', task.name),
      subtitle: jobSubtitle(jobById.get(task.jobId ?? '')),
      status: task.priority ?? task.status ?? undefined,
      dueAt: task.dueDate ? new Date(task.dueDate).toISOString() : null,
      href: '/tasks?status=Open&overdue=true',
      jobId: task.jobId,
    };
  }

  private dedupeTasks(rows: TaskRow[]): TaskRow[] {
    const seen = new Set<string>();
    const out: TaskRow[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
  }
}
