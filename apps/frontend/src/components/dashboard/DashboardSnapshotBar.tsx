import Link from 'next/link';
import { AlertTriangle, Bell, Briefcase, TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardInbox } from '@/types/api';
import { formatCurrency } from './dashboard-inbox.copy';

export function DashboardSnapshotBar({ snapshot }: { snapshot: DashboardInbox['snapshot'] }) {
  const cards = [
    {
      label: 'Active jobs',
      value: String(snapshot.activeJobs),
      hint: snapshot.unreadJobCount ? `${snapshot.unreadJobCount} unread` : 'In progress',
      href: '/jobs',
      icon: Briefcase,
      warn: false,
    },
    {
      label: 'Needs action',
      value: String(snapshot.actionRequired ?? 0),
      hint: 'Waiting on a decision',
      href: '#attention',
      icon: AlertTriangle,
      warn: (snapshot.actionRequired ?? 0) > 0,
    },
    {
      label: 'Unread',
      value: String(snapshot.unreadCount),
      hint: 'New notifications',
      href: '#unread',
      icon: Bell,
      warn: snapshot.unreadCount > 0,
    },
    {
      label: 'AR overdue',
      value: formatCurrency(snapshot.arTotalOverdue),
      hint: snapshot.arOverdueCount ? `${snapshot.arOverdueCount} invoices` : 'None overdue',
      href: '/finance/ar',
      icon: TrendingUp,
      warn: snapshot.arOverdueCount > 0,
    },
    {
      label: 'AP overdue',
      value: formatCurrency(snapshot.apTotalOverdue),
      hint: snapshot.apOverdueCount ? `${snapshot.apOverdueCount} bills` : 'None overdue',
      href: '/finance/ap',
      icon: TrendingDown,
      warn: snapshot.apOverdueCount > 0,
    },
  ];

  return (
    <>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.label}
            href={card.href}
            className="group flex h-full min-h-0 flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
              <Icon
                className={
                  card.warn ? 'h-3.5 w-3.5 shrink-0 text-amber-600' : 'h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600'
                }
              />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums tracking-tight text-slate-900">{card.value}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{card.hint}</p>
            </div>
          </Link>
        );
      })}
    </>
  );
}
