'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export interface PageContext {
  pathname: string;
  entityType?: string;
  entityId?: string;
  jobId?: string;
  pageLabel?: string;
}

const ROUTE_ENTITY_MAP: Record<string, { entityType: string; label: string }> = {
  assessments: { entityType: 'assessment', label: 'Assessments' },
  jobs: { entityType: 'job', label: 'Jobs' },
  claims: { entityType: 'claim', label: 'Claims' },
  quotes: { entityType: 'quote', label: 'Estimates' },
  tasks: { entityType: 'task', label: 'Tasks' },
  contacts: { entityType: 'contact', label: 'Contacts' },
  documents: { entityType: 'document', label: 'Documents' },
  invoices: { entityType: 'invoice', label: 'Invoices' },
  journals: { entityType: 'journal', label: 'Journals' },
  messages: { entityType: 'message', label: 'Communications' },
  appointments: { entityType: 'appointment', label: 'Appointments' },
  rfqs: { entityType: 'rfq', label: 'Request for Quotations' },
  proposals: { entityType: 'proposal', label: 'Proposals' },
  'purchase-orders': { entityType: 'purchase-order', label: 'Purchase Orders' },
  bills: { entityType: 'bill', label: 'Bills' },
  'work-orders': { entityType: 'work-order', label: 'Work Orders' },
  reports: { entityType: 'report', label: 'Reports' },
  schedule: { entityType: 'schedule', label: 'Schedule' },
  dashboard: { entityType: 'dashboard', label: 'Dashboard' },
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function usePageContext(): PageContext {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const routeKey = segments[0] ?? '';
    const mapping = ROUTE_ENTITY_MAP[routeKey];

    let entityId: string | undefined;
    let jobId: string | undefined;
    let pageLabel: string | undefined;

    if (mapping) {
      pageLabel = mapping.label;
      if (segments.length >= 2 && isUuid(segments[1])) {
        entityId = segments[1];
        pageLabel = `${mapping.label} Detail`;
      } else {
        pageLabel = `${mapping.label} List`;
      }
    }

    // Extract jobId from path (/jobs/[id]) or query (?jobId=)
    if (routeKey === 'jobs' && segments.length >= 2 && isUuid(segments[1])) {
      jobId = segments[1];
    }
    const queryJobId = searchParams.get('jobId');
    if (queryJobId && isUuid(queryJobId)) {
      jobId = queryJobId;
    }

    return {
      pathname,
      entityType: mapping?.entityType,
      entityId: mapping?.entityType === 'job' ? undefined : entityId,
      jobId,
      pageLabel,
    };
  }, [pathname, searchParams]);
}
