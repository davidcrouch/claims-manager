'use client';

import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SearchInput,
  ListEmptyState,
} from '@/components/shared/list-filters';

export function ContactsListClient() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Users}
          title="Contacts"
          total={0}
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
          <Button size="sm" className="shrink-0">
            <Plus className="mr-1 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Phone</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Data rows will render here once the contacts API is connected */}
            </tbody>
          </table>
        </div>
        <ListEmptyState label="No contacts yet. Contacts will appear here once the contacts API is connected." />
      </div>
    </div>
  );
}
