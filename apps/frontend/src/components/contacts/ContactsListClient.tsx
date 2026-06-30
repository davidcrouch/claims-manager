'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SearchInput,
  SortableColumnHeader,
  ListEmptyState,
  formatDate,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { fetchContactsAction } from '@/app/(app)/contacts/actions';
import type { Contact, PaginatedResponse } from '@/types/api';

const PAGE_SIZE = 20;

type ContactSortField = 'name' | 'email' | 'phone' | 'created_at';

interface ColDef { key: ContactSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'created_at', label: 'Created' },
];

export interface ContactsListClientProps {
  initialData: PaginatedResponse<Contact>;
}

export function ContactsListClient({ initialData }: ContactsListClientProps) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [columnSort, setColumnSort] = useState<{ field: ContactSortField; order: 'asc' | 'desc' }>({
    field: 'name',
    order: 'asc',
  });
  const lastFetchKeyRef = useRef<string | null>(null);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const fetchKey = `${debouncedSearch}|${page}|${sortParam}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    fetchContactsAction({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      sort: sortParam,
    }).then((res) => setData(res));
  }, [debouncedSearch, page, sortParam]);

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
        <ListPageHeader
          icon={Users}
          title="Contacts"
          total={data.total}
          showing={data.data.length}
          search={debouncedSearch}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchInput
            placeholder="Search contacts by name, email, or phone..."
            value={search}
            onChange={handleSearchChange}
          />
          <Button size="sm" className="shrink-0" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {data.data.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={columnSort.field}
                      sortOrder={columnSort.order}
                      onSort={handleColumnSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((contact) => (
                  <tr
                    key={contact.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {contact.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {contact.mobilePhone ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(contact.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <ListEmptyState label="No contacts found." />
        )}
      </div>

      <ContactFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
