'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, Loader2 } from 'lucide-react';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import { JobsListClient } from '@/components/jobs/JobsListClient';
import { fetchJobsPickerBootstrapAction } from '@/app/(app)/jobs/actions';
import type { Job, PaginatedResponse } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

const EXIT_ANIMATION_MS = 350;

export interface JobsPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobId: string;
  /** Custom select handler. When provided, overrides the default navigation to /jobs/[id]. */
  onJobSelect?: (job: Job) => void;
}

type Bootstrap = {
  jobs: PaginatedResponse<Job>;
  statusOptions: StatusOption[];
  jobTypes: { id: string; name: string }[];
};

export function JobsPickerDrawer({
  open,
  onOpenChange,
  selectedJobId,
  onJobSelect: externalJobSelect,
}: JobsPickerDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchJobsPickerBootstrapAction()
      .then((res) => {
        if (cancelled || !res) return;
        setBootstrap(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const pendingHref = useRef<string | null>(null);

  const handleSelect = useCallback((job: Job) => {
    if (job.id === selectedJobId) {
      onOpenChange(false);
      return;
    }
    if (externalJobSelect) {
      onOpenChange(false);
      setTimeout(() => externalJobSelect(job), EXIT_ANIMATION_MS);
      return;
    }
    const tab = searchParams.get('tab');
    pendingHref.current = tab
      ? `/jobs/${job.id}?tab=${encodeURIComponent(tab)}`
      : `/jobs/${job.id}`;
    onOpenChange(false);
    setTimeout(() => {
      if (pendingHref.current) {
        router.push(pendingHref.current);
        pendingHref.current = null;
      }
    }, EXIT_ANIMATION_MS);
  }, [selectedJobId, searchParams, onOpenChange, router, externalJobSelect]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Switch job"
      description="Select a job to open it in this view."
      icon={<Briefcase className="h-5 w-5" />}
      widthClassName="w-[60%]"
    >
      <BottomFormDrawerBody className="flex h-full flex-col !px-0 !py-0">
        {loading && !bootstrap ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : bootstrap ? (
          <JobsListClient
            key={`jobs-picker-${selectedJobId}`}
            variant="picker"
            initialData={bootstrap.jobs}
            statusOptions={bootstrap.statusOptions}
            jobTypes={bootstrap.jobTypes}
            selectedJobId={selectedJobId}
            onJobSelect={handleSelect}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center py-16">
            <p className="text-sm text-slate-400">Unable to load jobs.</p>
          </div>
        )}
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
