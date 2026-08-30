'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export interface PageContext {
  pathname: string;
  section?: 'admin' | 'app';
  entityType?: string;
  entityId?: string;
  jobId?: string;
  pageLabel?: string;
  adminArea?: string;
  parentEntityId?: string;
  activeTab?: string;
}

interface RouteEntityEntry {
  entityType: string;
  label: string;
}

const ROUTE_ENTITY_MAP: Record<string, RouteEntityEntry> = {
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

const ADMIN_ROUTE_MAP: Record<string, RouteEntityEntry> = {
  catalog: { entityType: 'catalog', label: 'Catalogues' },
  agents: { entityType: 'agent-config', label: 'Agents' },
  'capability-packs': { entityType: 'capability-pack', label: 'Capability Packs' },
  connections: { entityType: 'connection', label: 'Connections' },
  provisioning: { entityType: 'provisioning', label: 'Provisioning' },
  settings: { entityType: 'settings', label: 'Settings' },
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
    const isAdmin = routeKey === 'admin';

    let mapping: RouteEntityEntry | undefined;
    let section: 'admin' | 'app' | undefined;
    let adminArea: string | undefined;
    let entityId: string | undefined;
    let parentEntityId: string | undefined;
    let jobId: string | undefined;
    let pageLabel: string | undefined;
    let activeTab: string | undefined;

    if (isAdmin) {
      section = 'admin';
      adminArea = segments[1];
      mapping = adminArea ? ADMIN_ROUTE_MAP[adminArea] : undefined;

      if (mapping) {
        pageLabel = mapping.label;
        // /admin/catalog/[catalogId]
        if (segments.length >= 3 && isUuid(segments[2])) {
          entityId = segments[2];
          pageLabel = `${mapping.label} Detail`;
          // /admin/catalog/[catalogId]/items/[itemId]
          if (segments.length >= 5 && isUuid(segments[4])) {
            parentEntityId = entityId;
            entityId = segments[4];
          }
        } else {
          pageLabel = `${mapping.label} List`;
        }
      } else {
        pageLabel = adminArea
          ? `Admin: ${adminArea.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`
          : 'Admin';
      }
    } else {
      section = 'app';
      mapping = ROUTE_ENTITY_MAP[routeKey];

      if (mapping) {
        pageLabel = mapping.label;
        if (segments.length >= 2 && isUuid(segments[1])) {
          entityId = segments[1];
          pageLabel = `${mapping.label} Detail`;
        } else {
          pageLabel = `${mapping.label} List`;
        }
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

    if (mapping?.entityType === 'assessment' && entityId) {
      const VALID_TABS = [
        'attendance', 'building', 'habitability', 'hazards', 'damage',
        'makeSafe', 'temporaryAccommodation', 'specialists', 'recommendation',
      ];
      const tab = searchParams.get('tab');
      activeTab = VALID_TABS.includes(tab ?? '') ? tab! : 'attendance';
    }

    return {
      pathname,
      section,
      entityType: mapping?.entityType,
      entityId: mapping?.entityType === 'job' ? undefined : entityId,
      jobId,
      pageLabel,
      adminArea,
      parentEntityId,
      activeTab,
    };
  }, [pathname, searchParams]);
}
