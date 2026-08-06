'use client';

import { Fragment, useState } from 'react';
import { Users, User, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  SortableColumnHeader,
  TableEmptyRow,
  type ColumnValueFilter,
} from '@/components/shared/list-filters';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
  type ColumnVisibilityDef,
} from '@/components/shared/column-visibility';
import { formatDateTime } from '@/components/shared/detail';
import type { Appointment, AppointmentAttendee } from '@/types/api';

const APPOINTMENT_COLUMNS: ColumnVisibilityDef[] = [
  { key: 'name', label: 'Name', locked: true },
  { key: 'type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'start_date', label: 'Start' },
  { key: 'duration', label: 'Duration' },
  { key: 'status', label: 'Status' },
  { key: 'attendees', label: 'Attendees' },
];

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
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  statusColumnFilter?: ColumnValueFilter;
  typeColumnFilter?: ColumnValueFilter;
}

export function AppointmentsTable({
  appointments,
  loading,
  onRowClick,
  emptyLabel = 'No appointments found.',
  sortField,
  sortOrder = 'asc',
  onSort,
  statusColumnFilter,
  typeColumnFilter,
}: AppointmentsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'appointments',
    APPOINTMENT_COLUMNS,
  );

  function toggleExpanded(e: React.MouseEvent, id: string) {
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

  const noopSort = () => {};
  const useSortableHeaders = onSort || typeColumnFilter || statusColumnFilter;
  // Leading expand spacer + visible data columns + settings cell
  const emptyColSpan = 1 + visibleCount + 1;
  const expandedColSpan = visibleCount + 1;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-2.5 w-8" />
            {useSortableHeaders ? (
              <>
                {isVisible('name') && (
                  <SortableColumnHeader columnKey="name" label="Name" activeField={sortField ?? null} sortOrder={sortOrder} onSort={onSort ?? noopSort} />
                )}
                {isVisible('type') && (
                  <SortableColumnHeader
                    columnKey="type"
                    label="Type"
                    activeField={sortField ?? null}
                    sortOrder={sortOrder}
                    onSort={onSort ?? noopSort}
                    filter={typeColumnFilter}
                  />
                )}
                {isVisible('location') && (
                  <SortableColumnHeader columnKey="location" label="Location" activeField={sortField ?? null} sortOrder={sortOrder} onSort={onSort ?? noopSort} />
                )}
                {isVisible('start_date') && (
                  <SortableColumnHeader columnKey="start_date" label="Start" activeField={sortField ?? null} sortOrder={sortOrder} onSort={onSort ?? noopSort} />
                )}
                {isVisible('duration') && (
                  <th scope="col" className="px-4 py-2.5">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Duration
                  </th>
                )}
                {isVisible('status') && (
                  <SortableColumnHeader
                    columnKey="status"
                    label="Status"
                    activeField={sortField ?? null}
                    sortOrder={sortOrder}
                    onSort={onSort ?? noopSort}
                    filter={statusColumnFilter}
                  />
                )}
                {isVisible('attendees') && (
                  <th scope="col" className="px-4 py-2.5">Attendees</th>
                )}
              </>
            ) : (
              <>
                {isVisible('name') && (
                  <th scope="col" className="px-4 py-2.5">Name</th>
                )}
                {isVisible('type') && (
                  <th scope="col" className="px-4 py-2.5">Type</th>
                )}
                {isVisible('location') && (
                  <th scope="col" className="px-4 py-2.5">Location</th>
                )}
                {isVisible('start_date') && (
                  <th scope="col" className="px-4 py-2.5">Start</th>
                )}
                {isVisible('duration') && (
                  <th scope="col" className="px-4 py-2.5">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Duration
                  </th>
                )}
                {isVisible('status') && (
                  <th scope="col" className="px-4 py-2.5">Status</th>
                )}
                {isVisible('attendees') && (
                  <th scope="col" className="px-4 py-2.5">Attendees</th>
                )}
              </>
            )}
            <ColumnSettingsHeaderCell
              columns={APPOINTMENT_COLUMNS}
              isVisible={isVisible}
              onToggle={toggle}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {appointments.length === 0 ? (
            <TableEmptyRow colSpan={emptyColSpan} label={emptyLabel} />
          ) : (
            appointments.map((a) => {
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
                      onClick={(e) => toggleExpanded(e, a.id)}
                      className="inline-flex items-center justify-center rounded-md p-0.5 hover:bg-muted"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                  {isVisible('name') && (
                    <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  )}
                  {isVisible('type') && (
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {appointmentTypeName(a)}
                    </td>
                  )}
                  {isVisible('location') && (
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {a.location}
                      </span>
                    </td>
                  )}
                  {isVisible('start_date') && (
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(a.startDate)}
                    </td>
                  )}
                  {isVisible('duration') && (
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {appointmentDuration(a)}
                    </td>
                  )}
                  {isVisible('status') && (
                    <td className="px-4 py-2.5">
                      <StatusBadge status={appointmentStatusLabel(a)} />
                    </td>
                  )}
                  {isVisible('attendees') && (
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {attendees.length}
                    </td>
                  )}
                  <td className="px-2 py-3" aria-hidden />
                </tr>
                {isExpanded && (
                  <tr className="bg-muted/10">
                    <td />
                    <td colSpan={expandedColSpan} className="px-4 py-3">
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
          })
          )}
        </tbody>
      </table>
    </div>
  );
}
