'use client';

import { useMemo, useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SearchInput,
  ListEmptyState,
  formatDate,
} from '@/components/shared/list-filters';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import type { Contact, PaginatedResponse } from '@/types/api';

export interface ContactsListClientProps {
  initialData: PaginatedResponse<Contact>;
}

export function ContactsListClient({ initialData }: ContactsListClientProps) {
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initialData.data;
    return initialData.data.filter((c) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').toLowerCase();
      const email = (c.email ?? '').toLowerCase();
      const phone = (c.mobilePhone ?? '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [initialData.data, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Users}
          title="Contacts"
          total={initialData.total}
          showing={visibleRows.length}
          search={search}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchInput
            placeholder="Search contacts by name, email, or phone..."
            value={search}
            onChange={setSearch}
          />
          <Button size="sm" className="shrink-0" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {visibleRows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Phone</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((contact) => (
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
                      {contact.mobilePhone ?? contact.homePhone ?? contact.workPhone ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(contact.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ListEmptyState label="No contacts found. Click 'Add Contact' to create one." />
        )}
      </div>

      <ContactFormDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
