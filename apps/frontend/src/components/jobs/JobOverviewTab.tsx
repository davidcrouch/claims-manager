'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJobAppointmentsAction } from '@/app/(app)/jobs/[id]/actions';
import { AppointmentFormDrawer } from '@/components/forms/AppointmentFormDrawer';
import type { Job, Appointment } from '@/types/api';
import { CalendarPlus } from 'lucide-react';

function formatAddress(job: Job): string {
  const addr = job.address as Record<string, unknown> | undefined;
  if (!addr) return '';
  const parts = [
    addr.unitNumber ?? addr.unit_number,
    addr.streetNumber ?? addr.street_number,
    addr.streetName ?? addr.street_name,
    addr.suburb,
    addr.postcode,
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}

export function JobOverviewTab({ job }: { job: Job }) {
  const address = formatAddress(job) || job.addressSuburb || '-';
  const jobTypeName = (job.jobType as { name?: string })?.name ?? '-';
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadAppointments = useCallback(async () => {
    const data = await fetchJobAppointmentsAction(job.id);
    setAppointments(data ?? []);
  }, [job.id]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

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
          if (!open) loadAppointments();
        }}
        jobId={job.id}
      />
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium">Details</h2>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><span className="text-muted-foreground">Job type:</span> {jobTypeName}</p>
          <p><span className="text-muted-foreground">Request date:</span> {job.requestDate ? new Date(job.requestDate).toLocaleDateString() : '—'}</p>
          <p><span className="text-muted-foreground">Make safe required:</span> {job.makeSafeRequired ? 'Yes' : 'No'}</p>
          <p><span className="text-muted-foreground">Collect excess:</span> {job.collectExcess ? 'Yes' : 'No'}</p>
          {job.excess && <p><span className="text-muted-foreground">Excess:</span> {job.excess}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium">Address</h2>
        </CardHeader>
        <CardContent className="text-sm">
          <p>{address || '—'}</p>
        </CardContent>
      </Card>
      {job.jobInstructions && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Instructions</h2>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{job.jobInstructions}</p>
          </CardContent>
        </Card>
      )}
      {appointments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Appointments</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {appointments.map((a) => (
              <p key={a.id}>
                {a.name} • {a.location} •{' '}
                {a.startDate ? new Date(a.startDate).toLocaleString() : ''} –{' '}
                {a.endDate ? new Date(a.endDate).toLocaleString() : ''}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
