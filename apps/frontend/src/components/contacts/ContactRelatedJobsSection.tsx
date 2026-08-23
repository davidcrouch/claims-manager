'use client';

import Link from 'next/link';
import { Briefcase, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { formatDateTime } from '@/components/shared/detail';
import { jobDisplayName } from '@/components/shared/job-label';
import type { ContactRelatedJob } from '@/types/api';

function jobLabel(job: ContactRelatedJob): string {
  if (job.label?.trim()) return job.label.trim();
  return jobDisplayName({
    id: job.id,
    name: job.name ?? undefined,
    externalJobId: job.externalJobId ?? undefined,
    externalReference: job.externalReference ?? undefined,
  });
}

function jobLocation(job: ContactRelatedJob): string {
  return [job.addressSuburb, job.addressState].filter(Boolean).join(', ');
}

export interface ContactRelatedJobsSectionProps {
  relatedJobs: ContactRelatedJob[];
  loading?: boolean;
  currentJobId?: string | null;
  onJobNavigate?: () => void;
}

export function ContactRelatedJobsSection({
  relatedJobs,
  loading = false,
  currentJobId,
  onJobNavigate,
}: ContactRelatedJobsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Briefcase className="h-4 w-4" />
          <span>Related jobs</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:px-0">
        {relatedJobs.length === 0 ? (
          <p className="px-6 py-1.5 text-sm text-muted-foreground">
            {loading ? 'Loading related jobs…' : 'No related jobs.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-6 py-2.5">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-2.5">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatedJobs.map((job) => {
                  const isCurrent = currentJobId != null && job.id === currentJobId;
                  const location = jobLocation(job);
                  return (
                    <tr
                      key={job.id}
                      className={
                        isCurrent
                          ? 'bg-blue-50/60'
                          : 'transition-colors hover:bg-slate-50'
                      }
                    >
                      <td className="whitespace-nowrap px-6 py-2.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-medium text-primary hover:underline"
                            onClick={onJobNavigate}
                          >
                            {jobLabel(job)}
                          </Link>
                          {isCurrent && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {job.role ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {job.role}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {job.jobTypeName ? (
                          <TypeBadge type={job.jobTypeName} />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {job.statusName ? (
                          <StatusBadge status={job.statusName} />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            {location}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-2.5 text-slate-500">
                        {job.updatedAt ? formatDateTime(job.updatedAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
