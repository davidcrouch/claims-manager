'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck } from 'lucide-react';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  type SortOption,
} from '@/components/shared/list-filters';
import { AppointmentsTable } from '@/components/appointments/AppointmentsTable';
import { AppointmentFormDrawer } from '@/components/forms/AppointmentFormDrawer';
import { fetchAppointmentsAction } from '@/app/(app)/appointments/actions';
import type { Appointment } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'start_date', label: 'Start' },
  { key: 'name', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'location', label: 'Location' },
];

const STATUS_OPTIONS = [
  { id: 'Scheduled', name: 'Scheduled' },
  { id: 'Completed', name: 'Completed' },
  { id: 'Cancelled', name: 'Cancelled' },
];

export function AppointmentsListClient() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = statusFilter.size === 1 ? [...statusFilter][0] : undefined;
      const res = await fetchAppointmentsAction({
        page,
        limit,
        search: search || undefined,
        status,
        sort: sortField,
        order: sortOrder,
      });
      setAppointments(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortField, sortOrder, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sortField, sortOrder, statusFilter]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'start_date' ? 'asc' : 'desc');
    }
  };

  function handleRowClick(appointment: Appointment) {
    setEditingAppointment(appointment);
    setDrawerOpen(true);
  }

  function handleDrawerClose(open: boolean) {
    setDrawerOpen(open);
    if (!open) {
      setEditingAppointment(null);
      load();
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={CalendarCheck}
          title="Appointments"
          total={total}
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
            placeholder="Search appointments by title..."
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
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <AppointmentsTable
          appointments={appointments}
          loading={loading}
          onRowClick={handleRowClick}
        />

        {!loading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border px-3 py-1 hover:bg-muted disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-3 py-1 hover:bg-muted disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {editingAppointment && (
        <AppointmentFormDrawer
          open={drawerOpen}
          onOpenChange={handleDrawerClose}
          jobId={editingAppointment.jobId}
          appointment={editingAppointment}
        />
      )}
    </div>
  );
}
