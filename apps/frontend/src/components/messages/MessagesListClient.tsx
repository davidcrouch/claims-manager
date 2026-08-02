'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
} from '@/components/shared/list-filters';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Date' },
  { key: 'subject', label: 'Subject' },
];

const READ_OPTIONS = [
  { id: 'read', name: 'Read' },
  { id: 'unread', name: 'Unread' },
];

export function MessagesListClient() {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [readFilter, setReadFilter] = useState<Set<string>>(new Set());

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={MessageSquare}
          title="Messages"
          total={0}
          accent="slate"
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          disabled
          title="Create from a Job detail page"
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          New Message
        </Button>
      </SetHeaderActions>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search messages by subject, sender, or job reference..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={READ_OPTIONS}
            selected={readFilter}
            onSelectionChange={(id, checked) => {
              setReadFilter((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClearAll={() => setReadFilter(new Set())}
            onSelectAll={() => setReadFilter(new Set(READ_OPTIONS.map((o) => o.id)))}
            triggerEmptyLabel="All messages"
            menuTitle="Filter by status"
            itemNoun={{ singular: 'status', plural: 'statuses' }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Subject</th>
                <th scope="col" className="px-4 py-3">From</th>
                <th scope="col" className="px-4 py-3">To</th>
                <th scope="col" className="px-4 py-3">Job Ref</th>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Attachments</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Data rows will render here once the messages API is connected */}
            </tbody>
          </table>
        </div>
        <ListEmptyState label="No messages yet. Messages will appear here once the communications API is connected." />
      </div>
    </div>
  );
}
