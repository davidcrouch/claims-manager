'use client';

import { Fragment, useState } from 'react';
import { Users, User, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime } from '@/components/shared/detail';
import type { Appointment, AppointmentAttendee } from '@/types/api';

export function appointmentTypeName(a: Appointment): string {
  const t = a.appointmentType;
  if (!t) return '—';
  if (typeof t === 'string') return t;
  return t.name ?? t.externalReference ?? '—';
}

export function appointmentStatusLabel(a: Appointment): string {
  if (typeof a.status === 'string' && a.status) return a.status;
  if (a.cancelledAt) return 'Cancelled';
  return 'Scheduled';
}

export function appointmentDuration(a: Appointment): string {
  if (!a.startDate || !a.endDate) return '—';
  const ms = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
  if (ms <= 0 || Number.isNaN(ms)) return '—';
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function Attendees({ attendees }: { attendees?: AppointmentAttendee[] }) {
  const list = attendees ?? [];
  if (list.length === 0) {
    return <p className="text-xs text-muted-foreground">No attendees.</p>;
  }
  return (
    <ul className="space-y-1 text-xs">
      {list.map((a, i) => {
        const isUser = (a.attendeeType ?? '').toUpperCase() === 'USER';
        return (
          <li key={a.id ?? i} className="flex items-center gap-2">
            <span
              className={
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ' +
                (isUser
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground')
              }
            >
              {isUser ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              {isUser ? 'USER' : 'CONTACT'}
            </span>
            <span className="font-medium">{a.name ?? '—'}</span>
            {a.email && (
              <a
                href={`mailto:${a.email}`}
                className="text-muted-foreground hover:underline"
              >
                {a.email}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface AppointmentsTableProps {
  appointments: Appointment[];
  loading: boolean;
  onRowClick: (appointment: Appointment) => void;
  emptyLabel?: string;
}

export function AppointmentsTable({
  appointments,
  loading,
  onRowClick,
  emptyLabel = 'No appointments found.',
}: AppointmentsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
  }

  if (appointments.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-2.5 w-8" />
            <th scope="col" className="px-4 py-2.5">Name</th>
            <th scope="col" className="px-4 py-2.5">Type</th>
            <th scope="col" className="px-4 py-2.5">Location</th>
            <th scope="col" className="px-4 py-2.5">Start</th>
            <th scope="col" className="px-4 py-2.5">
              <Clock className="inline h-3 w-3 mr-1" />
              Duration
            </th>
            <th scope="col" className="px-4 py-2.5">Status</th>
            <th scope="col" className="px-4 py-2.5">Attendees</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments.map((a) => {
            const isExpanded = expanded.has(a.id);
            const attendees = a.attendees ?? [];
            return (
              <Fragment key={a.id}>
                <tr
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => onRowClick(a)}
                >
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      onClick={(e) => toggle(e, a.id)}
                      className="inline-flex items-center justify-center rounded-md p-0.5 hover:bg-muted"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {appointmentTypeName(a)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {a.location}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(a.startDate)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {appointmentDuration(a)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={appointmentStatusLabel(a)} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {attendees.length}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-muted/10">
                    <td />
                    <td colSpan={7} className="px-4 py-3">
                      <div className="space-y-2">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Attendees
                          </p>
                          <div className="mt-1">
                            <Attendees attendees={attendees} />
                          </div>
                        </div>
                        {a.cancellationReason && (
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Cancellation reason
                            </p>
                            <p className="mt-1 text-xs">
                              {a.cancellationReason}
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
