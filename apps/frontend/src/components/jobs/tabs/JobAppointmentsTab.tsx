'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarPlus, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppointmentFormDrawer, type JobParty } from '@/components/forms/AppointmentFormDrawer';
import { AppointmentsTable } from '@/components/appointments/AppointmentsTable';
import { fetchJobAppointmentsAction } from '@/app/(app)/jobs/[id]/actions';
import type { Appointment, Job } from '@/types/api';

export function JobAppointmentsTab({ jobId, job }: { jobId: string; job: Job }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

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

  const jobParties = ((job.apiPayload as Record<string, unknown>)?.contacts as JobParty[]) ?? [];

  function handleRowClick(appointment: Appointment) {
    setEditingAppointment(appointment);
    setDrawerOpen(true);
  }

  function handleCreate() {
    setEditingAppointment(null);
    setDrawerOpen(true);
  }

  function handleDrawerClose(open: boolean) {
    setDrawerOpen(open);
    if (!open) {
      setEditingAppointment(null);
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} size="sm">
          <CalendarPlus className="h-4 w-4 mr-2" />
          Create Appointment
        </Button>
      </div>
      <AppointmentFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        jobId={jobId}
        jobParties={jobParties}
        appointment={editingAppointment ?? undefined}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Appointments ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <AppointmentsTable
            appointments={appointments}
            loading={loading}
            onRowClick={handleRowClick}
            emptyLabel="No appointments scheduled."
          />
        </CardContent>
      </Card>
    </div>
  );
}
