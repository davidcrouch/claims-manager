export const DASHBOARD_EMPTY_COPY = {
  decisions: 'Nothing waiting on a decision.',
  today: 'Nothing scheduled today.',
  overdueTasks: 'No overdue or upcoming tasks.',
  unread: "You're caught up.",
  money: 'No overdue invoices or bills.',
  activeJobs: 'No active jobs in progress.',
} as const;

export function greetingForName(name?: string | null, now = new Date()): string {
  const hour = now.getHours();
  const hello =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const trimmed = name?.trim();
  return trimmed ? `${hello}, ${trimmed}` : hello;
}

export function formatDashboardDate(now = new Date()): string {
  return now.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function relativeDue(dueAt?: string | null, now = new Date()): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (Math.abs(diffMins) < 1) return 'now';
  if (Math.abs(diffMins) < 60) {
    return diffMins < 0 ? `${Math.abs(diffMins)}m ago` : `in ${diffMins}m`;
  }
  const diffHrs = Math.round(diffMins / 60);
  if (Math.abs(diffHrs) < 24) {
    return diffHrs < 0 ? `${Math.abs(diffHrs)}h ago` : `in ${diffHrs}h`;
  }
  const diffDays = Math.round(diffHrs / 24);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return `in ${diffDays}d`;
}

export function formatShortDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.length >= 10 ? value.slice(0, 10) : value;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function formatEventTime(dueAt?: string | null): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return dueAt.length >= 10 ? dueAt.slice(0, 10) : dueAt;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) return dueAt;
  return due.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
}
