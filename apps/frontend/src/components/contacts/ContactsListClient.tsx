'use client';

import { useEffect, useMemo, useState } from 'react';
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
  COLUMN_FILTER_BLANK,
  columnFilterKey,
  formatDate,
  parseArchiveListTab,
  statusValuesForArchiveListTab,
  type ArchiveListTab,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { jobDisplayName } from '@/components/shared/job-label';
import { JobCellLink } from '@/components/shared/JobCellLink';
import {
  buildListJobFilterOptions,
  buildServerJobFilterOptions,
  parseSelectedJobIds,
  resolveServerJobFilterSelection,
  selectedJobFilterLabels,
  writeServerJobFilterParams,
} from '@/components/shared/server-job-filter';
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData,
} from '@/components/shared/use-list-page-data';
import { fetchContactsAction } from '@/app/(app)/contacts/actions';
import type { Contact, PaginatedResponse, Job, Claim } from '@/types/api';

const PAGE_SIZE = 20;

type ListTab = ArchiveListTab;

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

function isContactArchived(contact: Contact): boolean {
  const status = contactStatusLabel(contact).toLowerCase();
  return status === 'archived';
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

function renderContactJobsCell(
  contact: Contact,
  selectedJobIds: string[],
  labelById: Record<string, string>,
) {
  const ids = selectedJobIds.filter((id) => id !== '__none__');
  if (ids.length === 1) {
    return <JobCellLink jobId={ids[0]} jobNameById={labelById} />;
  }

  const related = contact.relatedJobs ?? [];
  if (related.length === 0) {
    return COLUMN_FILTER_BLANK;
  }

  const labelFor = (j: NonNullable<Contact['relatedJobs']>[number]) =>
    j.label?.trim() ||
    jobDisplayName({
      id: j.id,
      name: j.name,
      externalJobId: j.externalJobId,
      externalReference: j.externalReference,
    });

  if (related.length === 1) {
    return <JobCellLink jobId={related[0].id} label={labelFor(related[0])} />;
  }

  return (
    <>
      <JobCellLink jobId={related[0].id} label={labelFor(related[0])} />
      {` +${related.length - 1}`}
    </>
  );
}

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
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<ListTab>(() =>
    parseArchiveListTab(searchParams.get('tab')),
  );
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
  const uniqueStatuses = useMemo(() => ['active', 'archived'], []);
  const statusParam = useMemo(
    () => statusValuesForArchiveListTab(tab, uniqueStatuses),
    [tab, uniqueStatuses],
  );

  const sortParam = `${columnSort.field}_${columnSort.order}`;
  const jobId = searchParams.get('jobId') ?? undefined;
  const jobIdsParam = searchParams.get('jobIds') ?? undefined;
  const unlinkedOnly =
    searchParams.get('unlinkedOnly') === '1' ||
    searchParams.get('unlinkedOnly') === 'true';

  const selectedJobIds = useMemo(
    () => parseSelectedJobIds(jobId, jobIdsParam),
    [jobId, jobIdsParam],
  );

  const normalizedFilterJobs = useMemo(
    () =>
      buildListJobFilterOptions({
        jobs: filterJobs,
        jobNameById,
        currentJob: job
          ? { id: job.id, label: jobDisplayName(job) }
          : null,
        jobId,
      }),
    [filterJobs, jobNameById, job, jobId],
  );

  const uniqueJobs = useMemo(
    () =>
      buildServerJobFilterOptions(normalizedFilterJobs, {
        includeBlank: hasUnlinkedContacts,
      }),
    [normalizedFilterJobs, hasUnlinkedContacts],
  );

  const { selected: jobFilter, active: jobFilterActive } = useMemo(
    () =>
      selectedJobFilterLabels({
        jobId,
        jobIds: jobIdsParam
          ? jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
          : undefined,
        unlinkedOnly,
        jobs: normalizedFilterJobs,
      }),
    [jobId, jobIdsParam, unlinkedOnly, normalizedFilterJobs],
  );

  const labelById = useMemo(() => {
    const map: Record<string, string> = { ...(jobNameById ?? {}) };
    for (const j of normalizedFilterJobs) {
      if (j.label.trim()) map[j.id] = j.label.trim();
    }
    return map;
  }, [jobNameById, normalizedFilterJobs]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const fetchKey = `${debouncedSearch}|${tab}|${page}|${sortParam}|${statusKey}|${jobId ?? ''}|${jobIdsParam ?? ''}|${unlinkedOnly ? '1' : ''}`;

    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    if (tab !== 'active') params.set('tab', tab);
    else params.delete('tab');
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (sortParam !== 'name_asc') params.set('sort', sortParam);
    else params.delete('sort');
    if (statusParam) params.set('status', statusParam); else params.delete('status');
    const next = params.toString();
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/contacts',
        currentQuery: searchParams.toString(),
        nextQuery: next,
      })
    ) {
      return;
    }

    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    if (statusParam === null) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    const ids = selectedJobIds.filter((id) => id !== '__none__');
    const matchNone = selectedJobIds.includes('__none__');

    if (matchNone && !unlinkedOnly) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    fetchContactsAction({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      sort: sortParam,
      status: statusParam,
      jobId: !unlinkedOnly && !matchNone && ids.length === 1 ? ids[0] : undefined,
      jobIds: !unlinkedOnly && !matchNone && ids.length > 1 ? ids : undefined,
      unlinkedOnly: unlinkedOnly || undefined,
    }).then((res) => {
      if (!session.cancelled) setData(res);
    });
    return session.cleanup;
  }, [debouncedSearch, tab, page, sortParam, statusParam, jobId, jobIdsParam, unlinkedOnly, selectedJobIds, searchParams, router, beginFetch, abortFetch]);

  const applyJobFilter = (next: Set<string>) => {
    const resolved = resolveServerJobFilterSelection({
      next,
      options: uniqueJobs,
      jobs: normalizedFilterJobs,
    });
    setPage(1);

    const params = new URLSearchParams(searchParams.toString());
    writeServerJobFilterParams(params, resolved);
    if (resolved.unlinkedOnly) {
      params.set('unlinkedOnly', '1');
    } else {
      params.delete('unlinkedOnly');
    }
    params.set('tab', tab);
    params.set('page', '1');

    const qs = params.toString();
    router.push(qs ? `/contacts?${qs}` : '/contacts');
  };

  const visibleRows = data.data;

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
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    {isVisible('job') && (
                      <td className="px-4 py-3 text-slate-600">
                        {renderContactJobsCell(contact, selectedJobIds, labelById)}
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
