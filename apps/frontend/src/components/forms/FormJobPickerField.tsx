'use client';

import { useMemo, useState } from 'react';
import { Briefcase, ChevronsUpDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { JobsPickerDrawer } from '@/components/jobs/JobsPickerDrawer';
import { formatAddress } from '@/components/shared/detail';
import {
  jobHeaderSubtitle,
  jobHeaderTitle,
  type JobOption,
} from '@/components/shared/job-label';
import type { Job } from '@/types/api';

export interface FormJobPickerFieldProps {
  value: string;
  selectedJob?: Job | null;
  jobs?: JobOption[];
  onJobSelect: (job: Job) => void;
  /** Allow clearing / changing when a job is already set. Defaults to true. */
  allowChange?: boolean;
  error?: string | null;
  className?: string;
}

function resolveJobAddress(
  job: Job | null | undefined,
  option: JobOption | undefined,
): string {
  if (job) {
    return formatAddress(job.address as Record<string, unknown> | undefined, {
      fallback: {
        suburb: job.addressSuburb,
        state: job.addressState,
        postcode: job.addressPostcode,
        country: job.addressCountry,
      },
    });
  }
  if (!option) return '';
  return formatAddress(
    (option.address as Record<string, unknown> | undefined) ?? {},
    {
      fallback: {
        suburb: option.addressSuburb,
        state: option.addressState,
        postcode: option.addressPostcode,
        country: option.addressCountry,
      },
    },
  );
}

export function FormJobPickerField({
  value,
  selectedJob,
  jobs,
  onJobSelect,
  allowChange = true,
  error,
  className = 'space-y-2',
}: FormJobPickerFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedOption = useMemo(
    () => jobs?.find((j) => j.id === value),
    [jobs, value],
  );
  const address = resolveJobAddress(selectedJob, selectedOption);
  const jobTypeName =
    selectedJob?.jobType?.name?.trim() || selectedOption?.jobType?.trim() || '';
  const canOpenPicker = allowChange || !value;

  return (
    <div className={className}>
      <Label>
        Job <span className="text-destructive">*</span>
      </Label>
      {value ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                Selected job
              </p>
              {selectedJob && jobHeaderSubtitle(selectedJob) ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {jobHeaderSubtitle(selectedJob)}
                </p>
              ) : null}
              <p className="mt-0.5 font-mono text-base font-semibold uppercase text-foreground">
                {selectedJob
                  ? jobHeaderTitle(selectedJob)
                  : (selectedOption?.label ?? value)}
              </p>
              {selectedJob?.insuredName?.trim() ? (
                <p className="mt-1 truncate text-sm text-foreground">
                  {selectedJob.insuredName.trim()}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {selectedJob?.status?.name ? (
                  <StatusBadge status={selectedJob.status.name} />
                ) : null}
                {jobTypeName ? <TypeBadge type={jobTypeName} /> : null}
                {address ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-0.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {address}
                  </span>
                ) : null}
              </div>
            </div>
            {canOpenPicker ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setPickerOpen(true)}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Change
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Briefcase className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-medium text-foreground">
              Select a job
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Search by job number, insurer ref, client, or address
            </span>
          </span>
        </button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <JobsPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedJobId={value}
        onJobSelect={onJobSelect}
        title="Select job"
        description="Choose the job this record belongs to."
      />
    </div>
  );
}
