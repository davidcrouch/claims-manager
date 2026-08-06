'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import {
  SearchInput,
  SortableColumnHeader,
  TableEmptyRow,
  formatDate,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { fetchContactsAction } from '@/app/(app)/contacts/actions';
import type { Contact, PaginatedResponse, Job, Claim } from '@/types/api';

const PAGE_SIZE = 20;

type ContactSortField = 'name' | 'email' | 'phone' | 'created_at';

interface ColDef { key: ContactSortField; label: string; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name', locked: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'created_at', label: 'Created' },
];

export interface ContactsListClientProps {
  initialData: PaginatedResponse<Contact>;
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function ContactsListClient({ initialData, job, parentClaim }: ContactsListClientProps) {
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const fetchKey = `${debouncedSearch}|${page}|${sortParam}|${jobId ?? ''}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    fetchContactsAction({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      sort: sortParam,
      jobId,
    }).then((res) => setData(res));
  }, [debouncedSearch, page, sortParam, jobId]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={Users}
          title="Contacts"
          total={data.total}
          showing={data.data.length}
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
              {data.data.length === 0 ? (
                <TableEmptyRow colSpan={visibleCount + 1} label="No contacts found." />
              ) : (
                data.data.map((contact) => (
                  <tr
                    key={contact.id}
                    className="transition-colors hover:bg-slate-50"
                  >
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

      <ContactFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} aiAssistEnabled />
    </div>
  );
}
