'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  TableEmptyRow,
  type SortOption,
} from '@/components/shared/list-filters';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
  type ColumnVisibilityDef,
} from '@/components/shared/column-visibility';
import type { Job, Claim } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Date' },
  { key: 'subject', label: 'Subject' },
];

const READ_OPTIONS = [
  { id: 'read', name: 'Read' },
  { id: 'unread', name: 'Unread' },
];

const MESSAGES_COLUMNS: ColumnVisibilityDef[] = [
  { key: 'subject', label: 'Subject', locked: true },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'job_ref', label: 'Job Ref' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'attachments', label: 'Attachments' },
];

export function MessagesListClient({ job, parentClaim }: { job?: Job | null; parentClaim?: Claim | null } = {}) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [readFilter, setReadFilter] = useState<Set<string>>(new Set());
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'messages',
    MESSAGES_COLUMNS,
  );

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
        <EntityPageHeader
          icon={MessageSquare}
          title="Messages"
          total={0}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
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
        <PrintButton documentType="messages_list" entityId="list" />
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
                {isVisible('subject') && (
                  <th scope="col" className="px-4 py-3">Subject</th>
                )}
                {isVisible('from') && (
                  <th scope="col" className="px-4 py-3">From</th>
                )}
                {isVisible('to') && (
                  <th scope="col" className="px-4 py-3">To</th>
                )}
                {isVisible('job_ref') && (
                  <th scope="col" className="px-4 py-3">Job Ref</th>
                )}
                {isVisible('date') && (
                  <th scope="col" className="px-4 py-3">Date</th>
                )}
                {isVisible('status') && (
                  <th scope="col" className="px-4 py-3">Status</th>
                )}
                {isVisible('attachments') && (
                  <th scope="col" className="px-4 py-3">Attachments</th>
                )}
                <th scope="col" className="px-4 py-3">Actions</th>
                <ColumnSettingsHeaderCell
                  columns={MESSAGES_COLUMNS}
                  isVisible={isVisible}
                  onToggle={toggle}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <TableEmptyRow
                colSpan={visibleCount + 1 + 1}
                label="No messages yet. Messages will appear here once the communications API is connected."
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
