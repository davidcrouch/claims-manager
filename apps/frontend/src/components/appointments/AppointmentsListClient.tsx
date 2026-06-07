'use client';

import { useState } from 'react';
import { CalendarCheck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
} from '@/components/shared/list-filters';

const SORT_OPTIONS: SortOption[] = [
  { key: 'start_date', label: 'Start' },
  { key: 'name', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'location', label: 'Location' },
];

const STATUS_OPTIONS = [
  { id: 'scheduled', name: 'Scheduled' },
  { id: 'completed', name: 'Completed' },
  { id: 'cancelled', name: 'Cancelled' },
];

export function AppointmentsListClient() {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'start_date' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={CalendarCheck}
          title="Appointments"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search appointments by title, entity, or location..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onSelectionChange={(id, checked) => {
              setStatusFilter((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClearAll={() => setStatusFilter(new Set())}
            onSelectAll={() => setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.id)))}
          />
          <Button size="sm" className="shrink-0" disabled title="Create from a Job detail page">
            <Plus className="mr-1 h-4 w-4" />
            Create Appointment
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Start</th>
                <th scope="col" className="px-4 py-3">Duration</th>
                <th scope="col" className="px-4 py-3">Title</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Location</th>
                <th scope="col" className="px-4 py-3">Address</th>
                <th scope="col" className="px-4 py-3">Attendees</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Data rows will render here once the appointments API is connected */}
            </tbody>
          </table>
        </div>
        <ListEmptyState label="No appointments yet. Appointments will appear here once the appointments API is connected." />
      </div>
    </div>
  );
}
