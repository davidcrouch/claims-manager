const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INACTIVE_JOB_STATUS_NAMES = [
  'archived',
  'completed',
  'closed',
  'cancelled',
  'canceled',
  'declined',
];

export const WO_ACCEPT_STATUS_NAMES = ['Received', 'Issued', 'Draft'];
export const PROPOSAL_REVIEW_STATUS_NAMES = ['Received', 'Under Review'];
export const RFQ_AWAITING_STATUS_NAMES = ['Sent'];
export const ESTIMATE_PUBLISH_STATUS_NAMES = ['Approved'];

export const EMPTY_COPY = {
  decisions: 'Nothing waiting on a decision.',
  today: 'Nothing scheduled today.',
  overdueTasks: 'No overdue or upcoming tasks.',
  unread: "You're caught up.",
  money: 'No overdue invoices or bills.',
  activeJobs: 'No active jobs.',
} as const;

export const INACTIVE_JOB_STATUS_LABELS = [
  'Archived',
  'Completed',
  'Closed',
  'Cancelled',
  'Canceled',
  'Declined',
];

export const ENTITY_DETAIL_ROUTES: Record<string, string> = {
  job: 'jobs',
  claim: 'claims',
  quote: 'quotes',
  purchase_order: 'purchase-orders',
  invoice: 'invoices',
  work_order: 'work-orders',
  rfq: 'rfqs',
  proposal: 'proposals',
  bill: 'bills',
  report: 'reports',
};

export const ENTITY_LIST_ROUTES: Record<string, string> = {
  message: '/messages',
  task: '/tasks',
  appointment: '/appointments',
  attachment: '/documents',
};

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function humanizeTitle(
  fallback: string,
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (isUuid(trimmed)) continue;
    return trimmed;
  }
  return fallback;
}

export function matchLookupIdsByNames(
  lookups: Array<{ id: string; name: string | null }>,
  names: string[],
): string[] {
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const ids: string[] = [];
  for (const lookup of lookups) {
    const name = lookup.name?.trim().toLowerCase();
    if (name && wanted.has(name)) ids.push(lookup.id);
  }
  return ids;
}

export function inactiveJobStatusIds(
  lookups: Array<{ id: string; name: string | null }>,
): string[] {
  return matchLookupIdsByNames(lookups, INACTIVE_JOB_STATUS_LABELS);
}

export function formatJobAddressLine(job: {
  addressSuburb?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
}): string | undefined {
  const parts = [job.addressSuburb, job.addressState, job.addressPostcode]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export function countActiveJobs(
  jobsByStatus: Array<{ status: string; count: string | number }>,
): number {
  let total = 0;
  for (const row of jobsByStatus) {
    const status = (row.status ?? '').trim().toLowerCase();
    if (INACTIVE_JOB_STATUS_NAMES.includes(status)) continue;
    total += Number(row.count) || 0;
  }
  return total;
}

export function overdueCountFromBuckets(
  buckets: Array<{ label: string; count: number }>,
): number {
  return buckets
    .filter((b) => b.label !== 'Current')
    .reduce((sum, b) => sum + (Number(b.count) || 0), 0);
}

export function statusFilterHref(basePath: string, statusIds: string[]): string {
  if (statusIds.length === 0) return basePath;
  return `${basePath}?status=${encodeURIComponent(statusIds.join(','))}`;
}

export function notificationHref(entityType: string, entityId: string): string {
  const type = entityType.trim().toLowerCase();
  const detail = ENTITY_DETAIL_ROUTES[type];
  if (detail && entityId) {
    return `/${detail}/${entityId}`;
  }
  return ENTITY_LIST_ROUTES[type] ?? '/notifications';
}

export function scheduleEventHref(eventType: string, id: string): string {
  switch (eventType) {
    case 'appointment':
      return `/appointments?open=${encodeURIComponent(id)}`;
    case 'task':
      return `/tasks?open=${encodeURIComponent(id)}`;
    case 'work_order':
      return `/work-orders/${id}`;
    case 'purchase_order':
      return `/purchase-orders/${id}`;
    case 'rfq':
      return `/rfqs/${id}`;
    case 'bill':
      return `/bills/${id}`;
    case 'quote':
      return `/quotes/${id}`;
    default:
      return '/schedule';
  }
}

export function jobSubtitle(
  job?: { externalReference?: string | null; name?: string | null } | null,
): string | undefined {
  if (!job) return undefined;
  return humanizeTitle('', job.externalReference, job.name) || undefined;
}

export function utcDayBounds(now = new Date()): { from: string; to: string } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function daysFromNow(days: number, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function shouldIncludeMyTasks(
  userId: string | null | undefined,
  assignedOpenCount: number,
): boolean {
  return Boolean(userId?.trim()) && assignedOpenCount > 0;
}
