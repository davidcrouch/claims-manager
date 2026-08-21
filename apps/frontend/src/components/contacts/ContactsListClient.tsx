'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import {
  SearchInput,
  SortableColumnHeader,
  TableEmptyRow,
  commitColumnFilterSelection,
  buildColumnFilterOptions,
  COLUMN_FILTER_BLANK,
  columnFilterKey,
  formatDate,
  isArchivedStatus,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { resolveJobName } from '@/components/shared/job-label';
import { fetchContactsAction } from '@/app/(app)/contacts/actions';
import type { Contact, PaginatedResponse, Job, Claim } from '@/types/api';

const PAGE_SIZE = 20;

type ListTab = 'active' | 'archived' | 'all';

function contactStatusLabel(contact: Contact): string {
  if (typeof contact.status === 'string' && contact.status.trim()) {
    return contact.status.trim();
  }
  const payload = contact.contactPayload;
  if (payload && typeof payload === 'object') {
    if (typeof payload.status === 'string' && payload.status.trim()) {
      return payload.status.trim();
    }
    if (payload.archived === true) return 'Archived';
    if (typeof payload.archivedAt === 'string' && payload.archivedAt.trim()) {
      return 'Archived';
    }
  }
  return 'Active';
}

/** Contacts have no first-class status column yet; derive archive from status/payload when present. */
function isContactArchived(contact: Contact): boolean {
  if (isArchivedStatus(contact.status)) return true;
  const payload = contact.contactPayload;
  if (!payload || typeof payload !== 'object') return false;
  if (payload.archived === true) return true;
  if (typeof payload.archivedAt === 'string' && payload.archivedAt.trim()) return true;
  if (typeof payload.status === 'string') {
    const status = payload.status.trim().toLowerCase();
    if (isArchivedStatus(status) || status === 'removed') return true;
  }
  return false;
}

type ContactSortField = 'job' | 'name' | 'email' | 'status' | 'phone' | 'created_at';

interface ColDef { key: ContactSortField; label: string; locked?: boolean; filterable?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'job', label: 'Job', filterable: true },
  { key: 'name', label: 'Name', locked: true },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'phone', label: 'Phone' },
  { key: 'created_at', label: 'Created' },
];

export interface ContactsListClientProps {
  initialData: PaginatedResponse<Contact>;
  job?: Job | null;
  parentClaim?: Claim | null;
  jobNameById?: Record<string, string>;
  /** Jobs that actually have contacts — drives Job column filter options. */
  filterJobs?: Array<{ id: string; label: string }>;
  hasUnlinkedContacts?: boolean;
}

export function ContactsListClient({
  initialData,
  job,
  parentClaim,
  jobNameById,
  filterJobs = [],
  hasUnlinkedContacts = false,
}: ContactsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<ListTab>('active');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [columnSort, setColumnSort] = useState<{ field: ContactSortField; order: 'asc' | 'desc' }>({
    field: 'name',
    order: 'asc',
  });
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'contacts',
    TABLE_COLUMNS,
  );
  const lastFetchKeyRef = useRef<string | null>(null);

  const sortParam = `${columnSort.field}_${columnSort.order}`;
  const jobId = searchParams.get('jobId') ?? undefined;
  const jobIdsParam = searchParams.get('jobIds') ?? undefined;
  const unlinkedOnly =
    searchParams.get('unlinkedOnly') === '1' ||
    searchParams.get('unlinkedOnly') === 'true';

  const selectedJobIds = useMemo(() => {
    if (jobIdsParam) {
      return jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
    }
    if (jobId) return [jobId];
    return [] as string[];
  }, [jobId, jobIdsParam]);

  const labelById = useMemo(() => {
    const map: Record<string, string> = { ...(jobNameById ?? {}) };
    for (const j of filterJobs) {
      if (j.label.trim()) map[j.id] = j.label.trim();
    }
    return map;
  }, [jobNameById, filterJobs]);

  const uniqueJobs = useMemo(() => {
    const labels = filterJobs.map((j) => j.label);
    return buildColumnFilterOptions(labels, {
      alwaysIncludeBlank: hasUnlinkedContacts,
    });
  }, [filterJobs, hasUnlinkedContacts]);

  const jobFilter = useMemo(() => {
    if (unlinkedOnly) return new Set([COLUMN_FILTER_BLANK]);
    if (selectedJobIds.length === 0) return new Set<string>();
    return new Set(
      selectedJobIds
        .map((id) => columnFilterKey(resolveJobName(id, labelById) || labelById[id] || id))
        .filter(Boolean),
    );
  }, [unlinkedOnly, selectedJobIds, labelById]);

  const jobFilterActive = unlinkedOnly || selectedJobIds.length > 0;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const archivedParam =
      tab === 'archived' ? true : tab === 'active' ? false : undefined;
    const archivedKey =
      archivedParam === true ? '1' : archivedParam === false ? '0' : '';
    const fetchKey = `${debouncedSearch}|${page}|${sortParam}|${tab}|${archivedKey}|${jobId ?? ''}|${jobIdsParam ?? ''}|${unlinkedOnly ? '1' : ''}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    fetchContactsAction({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      sort: sortParam,
      jobId: selectedJobIds.length === 1 && !unlinkedOnly ? selectedJobIds[0] : undefined,
      jobIds:
        selectedJobIds.length > 1 && !unlinkedOnly ? selectedJobIds : undefined,
      unlinkedOnly: unlinkedOnly || undefined,
      archived: archivedParam,
    }).then((res) => setData(res));
  }, [
    debouncedSearch,
    page,
    sortParam,
    tab,
    jobId,
    jobIdsParam,
    unlinkedOnly,
    selectedJobIds,
  ]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const applyJobFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueJobs.length,
    });
    setPage(1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('jobId');
    params.delete('jobIds');
    params.delete('unlinkedOnly');

    if (!committed.active) {
      const qs = params.toString();
      router.push(qs ? `/contacts?${qs}` : '/contacts');
      return;
    }

    if (committed.selected.size === 0) {
      // Explicit empty selection → show no rows via empty jobIds
      params.set('jobIds', '__none__');
      router.push(`/contacts?${params.toString()}`);
      return;
    }

    const wantsBlank = committed.selected.has(COLUMN_FILTER_BLANK);
    const selectedLabels = new Set(
      [...committed.selected]
        .filter((label) => label !== COLUMN_FILTER_BLANK)
        .map((label) => label.trim()),
    );
    const ids = filterJobs
      .filter((j) => selectedLabels.has(j.label.trim()))
      .map((j) => j.id);

    if (wantsBlank && ids.length === 0) {
      params.set('unlinkedOnly', '1');
    } else if (!wantsBlank && ids.length === 1) {
      params.set('jobId', ids[0]);
    } else if (!wantsBlank && ids.length > 1) {
      params.set('jobIds', ids.join(','));
    } else if (wantsBlank && ids.length > 0) {
      // Blank + jobs: show jobs only (blank is exclusive server-side)
      if (ids.length === 1) params.set('jobId', ids[0]);
      else params.set('jobIds', ids.join(','));
    }

    router.push(`/contacts?${params.toString()}`);
  };

  const visibleRows = data.data;

  const jobColumnLabel = useMemo(() => {
    if (unlinkedOnly) return COLUMN_FILTER_BLANK;
    if (selectedJobIds.length === 1) {
      return (
        resolveJobName(selectedJobIds[0], labelById) ||
        labelById[selectedJobIds[0]] ||
        '—'
      );
    }
    if (selectedJobIds.length > 1) {
      return `${selectedJobIds.length} jobs`;
    }
    return '—';
  }, [unlinkedOnly, selectedJobIds, labelById]);

  const formatContactJobs = (contact: Contact): string => {
    // When filtered to one job, show that job for clarity
    if (selectedJobIds.length === 1) {
      return jobColumnLabel;
    }
    const related = contact.relatedJobs ?? [];
    if (related.length === 0) return COLUMN_FILTER_BLANK;
    if (related.length === 1) {
      return related[0].label?.trim() || related[0].name?.trim() || related[0].id;
    }
    const first =
      related[0].label?.trim() || related[0].name?.trim() || related[0].id;
    return `${first} +${related.length - 1}`;
  };

  const handleColumnSort = (field: ContactSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'name' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (value: string) => {
    setTab(value as ListTab);
    setPage(1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={Users}
          title="Contacts"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Add Contact
        </Button>
        <PrintButton documentType="contacts_list" entityId="list" />
      </SetHeaderActions>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <SearchInput
            placeholder="Search contacts by name, email, or phone..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                {TABLE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                  <SortableColumnHeader
                    key={col.key}
                    columnKey={col.key}
                    label={col.label}
                    activeField={columnSort.field}
                    sortOrder={columnSort.order}
                    onSort={handleColumnSort}
                    filter={
                      col.key === 'job'
                        ? {
                            options: uniqueJobs,
                            selected: jobFilterActive
                              ? jobFilter
                              : new Set(uniqueJobs.map(columnFilterKey)),
                            active: jobFilterActive,
                            onApply: applyJobFilter,
                            menuTitle: 'Filter by job',
                            itemNoun: { singular: 'job', plural: 'jobs' },
                          }
                        : undefined
                    }
                  />
                ))}
                <ColumnSettingsHeaderCell
                  columns={TABLE_COLUMNS}
                  isVisible={isVisible}
                  onToggle={toggle}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow colSpan={visibleCount + 1} label="No contacts found." />
              ) : (
                visibleRows.map((contact) => (
                  <tr
                    key={contact.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    {isVisible('job') && (
                      <td className="px-4 py-3 text-slate-600">
                        {formatContactJobs(contact)}
                      </td>
                    )}
                    {isVisible('name') && (
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                      </td>
                    )}
                    {isVisible('email') && (
                      <td className="px-4 py-3 text-slate-600">
                        {contact.email ?? '—'}
                      </td>
                    )}
                    {isVisible('status') && (
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={contactStatusLabel(contact)}
                          variant={
                            isContactArchived(contact) ? 'inactive' : 'active'
                          }
                        />
                      </td>
                    )}
                    {isVisible('phone') && (
                      <td className="px-4 py-3 text-slate-600">
                        {contact.mobilePhone ?? '—'}
                      </td>
                    )}
                    {isVisible('created_at') && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(contact.createdAt)}
                      </td>
                    )}
                    <td className="px-2 py-3" aria-hidden />
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ContactFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
