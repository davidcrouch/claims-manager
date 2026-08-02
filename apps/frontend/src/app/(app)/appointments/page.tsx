import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { AppointmentsListClient } from '@/components/appointments/AppointmentsListClient';
import { toJobOptions } from '@/components/shared/job-label';
import type { Job, PaginatedResponse } from '@/types/api';

export const metadata = { title: 'Appointments — EnsureOS' };

export default async function AppointmentsPage() {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const jobsRes = await api.getJobs({ limit: 100 }).catch((err: unknown) => {
    console.error(
      'frontend:AppointmentsPage - getJobs failed:',
      err instanceof Error ? err.message : err,
    );
    return emptyJobs;
  });

  return <AppointmentsListClient jobs={toJobOptions(jobsRes?.data ?? [])} />;
}
