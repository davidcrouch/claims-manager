'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Job } from '@/types/api';

export const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveCurrentJobId(
  pathname: string,
  searchParams: { get: (name: string) => string | null },
): string | null {
  const jobMatch = pathname.match(/^\/jobs\/([^/?]+)/);
  const rawJobId = jobMatch?.[1] ?? searchParams.get('jobId');
  return rawJobId && JOB_ID_RE.test(rawJobId) ? rawJobId : null;
}

interface CurrentJobContextValue {
  jobId: string | null;
  setRegisteredJob: (job: Job | null) => void;
  setUrlJobId: (jobId: string | null) => void;
}

const CurrentJobContext = createContext<CurrentJobContextValue | null>(null);

export function CurrentJobProvider({ children }: { children: ReactNode }) {
  const [registeredJob, setRegisteredJobState] = useState<Job | null>(null);
  const [urlJobId, setUrlJobId] = useState<string | null>(null);

  const setRegisteredJob = useCallback((job: Job | null) => {
    setRegisteredJobState(job);
  }, []);

  const jobId = registeredJob?.id ?? urlJobId;

  const value = useMemo(
    () => ({
      jobId,
      setRegisteredJob,
      setUrlJobId,
    }),
    [jobId, setRegisteredJob],
  );

  return (
    <CurrentJobContext.Provider value={value}>{children}</CurrentJobContext.Provider>
  );
}

/**
 * Reads the selected job id from the URL so sidebar links stay job-scoped.
 * Rendered inside the app shell so `useSearchParams` does not wrap the layout.
 */
export function CurrentJobUrlBridge() {
  const ctx = useCurrentJobOptional();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlJobId = resolveCurrentJobId(pathname, searchParams);
  const setUrlJobId = ctx?.setUrlJobId;

  useEffect(() => {
    if (!setUrlJobId) return;
    setUrlJobId(urlJobId);
  }, [setUrlJobId, urlJobId]);

  return null;
}

export function useCurrentJob() {
  const ctx = useContext(CurrentJobContext);
  if (!ctx) {
    throw new Error(
      '[CurrentJobProvider.useCurrentJob] useCurrentJob must be used within CurrentJobProvider',
    );
  }
  return ctx;
}

export function useCurrentJobOptional() {
  return useContext(CurrentJobContext);
}

/**
 * Registers the page's job as the current job while mounted so sidebar links
 * stay scoped when a detail page has no `?jobId=` query.
 */
export function SetCurrentJob({ job }: { job?: Job | null }) {
  const ctx = useCurrentJobOptional();
  const jobId = job?.id ?? null;
  const jobRef = useRef(job);
  jobRef.current = job;
  const setRegisteredJob = ctx?.setRegisteredJob;

  useEffect(() => {
    if (!setRegisteredJob) {
      console.error(
        '[SetCurrentJob] useCurrentJob must be used within CurrentJobProvider',
      );
      return;
    }
    setRegisteredJob(jobRef.current ?? null);
    return () => setRegisteredJob(null);
  }, [setRegisteredJob, jobId]);

  return null;
}
