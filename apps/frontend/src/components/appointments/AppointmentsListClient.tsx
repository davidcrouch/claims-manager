'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  commitColumnFilterSelection,
  type SortOption,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  AppointmentsTable,
  appointmentTypeName,
} from '@/components/appointments/AppointmentsTable';
import { AppointmentFormDrawer } from '@/components/forms/AppointmentFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { fetchAppointmentsAction } from '@/app/(app)/appointments/actions';
import type { Appointment, Job, Claim } from '@/types/api';

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

export function AppointmentsListClient({
  jobs = [],
  job,
  parentClaim,
}: {
  jobs?: JobOption[];
  job?: Job | null;
  parentClaim?: Claim | null;
}) {
  const searchParams = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusNameFilter, setStatusNameFilter] = useState<Set<string>>(new Set());
  const [statusNameFilterActive, setStatusNameFilterActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const limit = 20;
  const statusParam = useMemo(
    () => [...statusFilter].sort().join(',') || undefined,
    [statusFilter],
  );

  const jobId = searchParams.get('jobId') ?? undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAppointmentsAction({
        page,
        limit,
        search: search || undefined,
        status: statusParam,
        sort: sortField,
        order: sortOrder,
        jobId,
      });
      setAppointments(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortField, sortOrder, statusParam, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sortField, sortOrder, statusParam]);

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

  function handleCreate() {
    setEditingAppointment(null);
    setDrawerOpen(true);
  }

  function handleDrawerClose(open: boolean) {
    setDrawerOpen(open);
    if (!open) {
      setEditingAppointment(null);
      load();
    }
  }

  const uniqueStatuses = useMemo(
    () => STATUS_OPTIONS.map((o) => o.name).sort((a, b) => a.localeCompare(b)),
    [],
  );

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const a of appointments) {
      const name = appointmentTypeName(a).trim();
      if (name && name !== '—') names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [appointments]);

  const applyStatusNameFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusNameFilter(committed.selected);
    setStatusNameFilterActive(committed.active);
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const visibleAppointments = useMemo(() => {
    let rows = appointments;

    if (statusNameFilterActive) {
      if (statusNameFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((a) => {
          const name = a.status?.trim();
          return name ? statusNameFilter.has(name) : false;
        });
      }
    }

    if (typeFilterActive) {
      if (typeFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((a) => {
          const name = appointmentTypeName(a).trim();
          return name && name !== '—' ? typeFilter.has(name) : false;
        });
      }
    }

    return rows;
  }, [appointments, statusNameFilterActive, statusNameFilter, typeFilterActive, typeFilter]);

  const breakdown = computeStatusBreakdown(visibleAppointments, (a) => a.status);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={CalendarCheck}
          title="Appointments"
          total={total}
          showing={visibleAppointments.length}
          breakdown={breakdown}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={handleCreate}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Add Appointment
        </Button>
        <PrintButton documentType="appointments_list" entityId="list" />
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
              setPage(1);
            }}
            onClearAll={() => { setStatusFilter(new Set()); setPage(1); }}
            onSelectAll={() => { setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.id))); setPage(1); }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <AppointmentsTable
          appointments={visibleAppointments}
          loading={loading}
          onRowClick={handleRowClick}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          statusColumnFilter={{
            options: uniqueStatuses,
            selected: statusNameFilter,
            active: statusNameFilterActive,
            onApply: applyStatusNameFilter,
            menuTitle: 'Filter by status',
            itemNoun: { singular: 'status', plural: 'statuses' },
          }}
          typeColumnFilter={{
            options: uniqueTypes,
            selected: typeFilter,
            active: typeFilterActive,
            onApply: applyTypeFilter,
            menuTitle: 'Filter by type',
            itemNoun: { singular: 'type', plural: 'types' },
          }}
        />

        {!loading && (
          <TablePagination
            page={page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      <AppointmentFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        jobId={editingAppointment?.jobId ?? job?.id}
        jobs={jobs}
        appointment={editingAppointment ?? undefined}
      />
    </div>
  );
}
