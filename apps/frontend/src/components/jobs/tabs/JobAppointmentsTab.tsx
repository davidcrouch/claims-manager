'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { CalendarPlus, Calendar, Users, User, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { AppointmentFormDrawer } from '@/components/forms/AppointmentFormDrawer';
import { fetchJobAppointmentsAction } from '@/app/(app)/jobs/[id]/actions';
import { formatDateTime } from '@/components/shared/detail';
import type { Appointment, AppointmentAttendee } from '@/types/api';

function appointmentTypeName(a: Appointment): string {
  const t = a.appointmentType;
  if (!t) return '—';
  if (typeof t === 'string') return t;
  return t.name ?? t.externalReference ?? '—';
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

export function JobAppointmentsTab({ jobId }: { jobId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobAppointmentsAction(jobId);
      setAppointments(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <CalendarPlus className="h-4 w-4 mr-2" />
          Create Appointment
        </Button>
      </div>
      <AppointmentFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Appointments ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : appointments.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">
              No appointments scheduled.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 w-8" />
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Location</th>
                    <th className="px-4 py-2">Start</th>
                    <th className="px-4 py-2">End</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Attendees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {appointments.map((a) => {
                    const open = expanded.has(a.id);
                    const attendees = a.attendees ?? [];
                    const statusName =
                      (a.status as string | undefined) ??
                      (a.cancelledAt ? 'Cancelled' : 'Scheduled');
                    return (
                      <Fragment key={a.id}>
                        <tr className="hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              aria-label={open ? 'Collapse' : 'Expand'}
                              onClick={() => toggle(a.id)}
                              className="inline-flex items-center justify-center rounded-md p-0.5 hover:bg-muted"
                            >
                              {open ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-2 font-medium">{a.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {appointmentTypeName(a)}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {a.location}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDateTime(a.startDate)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDateTime(a.endDate)}
                          </td>
                          <td className="px-4 py-2">
                            <StatusBadge status={statusName} />
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {attendees.length}
                          </td>
                        </tr>
                        {open && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
