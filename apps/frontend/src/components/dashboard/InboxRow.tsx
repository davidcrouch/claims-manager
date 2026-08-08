import Link from 'next/link';
import {
  Briefcase,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  FileInput,
  FileQuestion,
  FileSpreadsheet,
  Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardInboxItem } from '@/types/api';
import { relativeDue } from './dashboard-inbox.copy';

const ENTITY_ICONS: Record<string, LucideIcon> = {
  work_order: ClipboardCheck,
  proposal: FileInput,
  rfq: FileQuestion,
  quote: FileSpreadsheet,
  task: CheckSquare,
  appointment: CalendarCheck,
  job: Briefcase,
};

function iconFor(entityType: string): LucideIcon {
  return ENTITY_ICONS[entityType] ?? Bell;
}

export function InboxRow({ item, emphasizeOverdue }: { item: DashboardInboxItem; emphasizeOverdue?: boolean }) {
  const Icon = iconFor(item.entityType);
  const due = relativeDue(item.dueAt);
  const overdue = Boolean(
    emphasizeOverdue && item.dueAt && new Date(item.dueAt).getTime() < Date.now(),
  );

  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-slate-50"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900">{item.title}</div>
        {(item.subtitle || item.status) && (
          <div className="truncate text-xs text-slate-500">
            {[item.subtitle, item.status].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {due && (
        <span
          className={
            overdue
              ? 'shrink-0 text-xs font-medium text-destructive'
              : 'shrink-0 text-xs text-muted-foreground'
          }
        >
          {due}
        </span>
      )}
    </Link>
  );
}
