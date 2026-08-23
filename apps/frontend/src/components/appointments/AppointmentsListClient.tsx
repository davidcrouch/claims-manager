'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  buildColumnFilterOptions,
  columnFilterToIdsParam,
  type SortOption } from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  AppointmentsTable } from '@/components/appointments/AppointmentsTable';
import { AppointmentFormDrawer } from '@/components/forms/AppointmentFormDrawer';
import { type JobOption, jobDisplayName } from '@/components/shared/job-label';
import { buildServerJobFilterOptions,
  resolveServerJobFilterSelection,
  selectedJobFilterLabels,
  parseSelectedJobIds,
  toServerJobFetchParams,
  writeServerJobFilterParams, buildListJobFilterOptions } from '@/components/shared/server-job-filter';
import {
  fetchAppointmentsAction,
  fetchAppointmentFilterLocationsAction,
  fetchAppointmentFilterTypesAction } from '@/app/(app)/appointments/actions';
import { useEntityDrawer } from '@/components/layout/EntityDrawerHost';
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
  parentClaim }: {
  jobs?: JobOption[];
  job?: Job | null;
  parentClaim?: Claim | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openEntityDrawer } = useEntityDrawer();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('start_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [typeOptions, setTypeOptions] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [locationFilter, setLocationFilter] = useState<Set<string>>(new Set());
  const [locationFilterActive, setLocationFilterActive] = useState(false);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const loadGenRef = useRef(0);
  const limit = 20;
  const statusParam = useMemo(() => {
    if (statusFilter.has('__none__')) return '__none__';
    if (statusFilter.size === 0 || statusFilter.size === STATUS_OPTIONS.length) {
      return undefined;
    }
    return [...statusFilter].sort().join(',');
  }, [statusFilter]);

  const jobId = searchParams.get('jobId') ?? undefined;
  const jobIdsParam = searchParams.get('jobIds') ?? undefined;
  const openAppointmentId = searchParams.get('open');
  const jobNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const j of jobs) map[j.id] = j.label;
    return map;
  }, [jobs]);

  const filterJobs = useMemo(
    () =>
      buildListJobFilterOptions({
        jobs: jobs.map((j) => ({ id: j.id, label: j.label })),
        currentJob: job
          ? { id: job.id, label: jobDisplayName(job) }
          : null,
        jobId }),
    [jobs, job, jobId],
  );
  const uniqueJobs = useMemo(
    () => buildServerJobFilterOptions(filterJobs),
    [filterJobs],
  );
  const selectedJobIds = useMemo(
    () => parseSelectedJobIds(jobId, jobIdsParam),
    [jobId, jobIdsParam],
  );
  const { selected: jobFilter, active: jobFilterActive } = useMemo(
    () =>
      selectedJobFilterLabels({
        jobId,
        jobIds: jobIdsParam
          ? jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
          : undefined,
        jobs: filterJobs }),
    [jobId, jobIdsParam, filterJobs],
  );
  const { jobId: fetchJobId, jobIds: fetchJobIds } = useMemo(
    () => toServerJobFetchParams(selectedJobIds),
    [selectedJobIds],
  );

  const statusColumnActive =
    statusFilter.has('__none__') ||
    (statusFilter.size > 0 && statusFilter.size < STATUS_OPTIONS.length);
  const statusColumnSelected = statusFilter.has('__none__')
    ? new Set<string>()
    : statusFilter.size === 0
      ? new Set(STATUS_OPTIONS.map((o) => o.name))
      : statusFilter;

  const locationParam = useMemo(() => {
    if (!locationFilterActive) return undefined;
    if (locationFilter.size === 0) return '__none__';
    if (
      locationOptions.length > 0 &&
      locationFilter.size >= locationOptions.length
    ) {
      return undefined;
    }
    return [...locationFilter].sort().join(',');
  }, [locationFilterActive, locationFilter, locationOptions]);

  const appointmentTypeLookupIdsParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, typeOptions),
    [typeFilterActive, typeFilter, typeOptions],
  );

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      if (
        statusParam === '__none__' ||
        locationParam === '__none__' ||
        appointmentTypeLookupIdsParam === null
      ) {
        if (gen !== loadGenRef.current) return;
        setAppointments([]);
        setTotal(0);
        return;
      }
      const res = await fetchAppointmentsAction({
        page,
        limit,
        search: search || undefined,
        status: statusParam,
        location: locationParam,
        appointmentTypeLookupIds: appointmentTypeLookupIdsParam,
        sort: sortField,
        order: sortOrder,
        jobId: fetchJobId,
        jobIds: fetchJobIds });
      if (gen !== loadGenRef.current) return;
      setAppointments(res.data);
      setTotal(res.total);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [
    page,
    search,
    sortField,
    sortOrder,
    statusParam,
    locationParam,
    appointmentTypeLookupIdsParam,
    fetchJobId,
    fetchJobIds,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchAppointmentFilterLocationsAction().then(setLocationOptions);
    fetchAppointmentFilterTypesAction().then(setTypeOptions);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    sortField,
    sortOrder,
    statusParam,
    locationParam,
    appointmentTypeLookupIdsParam,
    jobId,
    jobIdsParam,
  ]);

  useEffect(() => {
    if (!openAppointmentId) return;
    openEntityDrawer({
      component: 'AppointmentFormDrawer',
      props: { appointmentId: openAppointmentId } });
    const params = new URLSearchParams(searchParams.toString());
    params.delete('open');
    const qs = params.toString();
    router.replace(qs ? `/appointments?${qs}` : '/appointments', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per openAppointmentId
  }, [openAppointmentId]);

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

  const uniqueTypes = useMemo(
    () =>
      [...new Set(typeOptions.map((t) => t.name.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [typeOptions],
  );


  const uniqueLocations = useMemo(
    () => buildColumnFilterOptions(locationOptions, { alwaysIncludeBlank: false }),
    [locationOptions],
  );

  const applyStatusNameFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length });
    if (!committed.active) {
      setStatusFilter(new Set());
    } else if (committed.selected.size === 0) {
      setStatusFilter(new Set(['__none__']));
    } else {
      setStatusFilter(committed.selected);
    }
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const applyJobFilter = (next: Set<string>) => {
    const resolved = resolveServerJobFilterSelection({
      next,
      options: uniqueJobs,
      jobs: filterJobs });
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    writeServerJobFilterParams(params, resolved);
    const qs = params.toString();
    router.replace(qs ? `/appointments?${qs}` : '/appointments', { scroll: false });
  };

  const applyLocationFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueLocations.length });
    setLocationFilter(committed.selected);
    setLocationFilterActive(committed.active);
    setPage(1);
  };

  const visibleAppointments = appointments;

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
          jobNameById={jobNameById}
          statusColumnFilter={{
            options: uniqueStatuses,
            selected: statusColumnSelected,
            active: statusColumnActive,
            onApply: applyStatusNameFilter,
            menuTitle: 'Filter by status',
            itemNoun: { singular: 'status', plural: 'statuses' } }}
          typeColumnFilter={{
            options: uniqueTypes,
            selected: typeFilter,
            active: typeFilterActive,
            onApply: applyTypeFilter,
            menuTitle: 'Filter by type',
            itemNoun: { singular: 'type', plural: 'types' } }}
          jobColumnFilter={{
            options: uniqueJobs,
            selected: jobFilterActive ? jobFilter : new Set(uniqueJobs),
            active: jobFilterActive,
            onApply: applyJobFilter,
            menuTitle: 'Filter by job',
            itemNoun: { singular: 'job', plural: 'jobs' } }}
          locationColumnFilter={{
            options: uniqueLocations,
            selected: locationFilter,
            active: locationFilterActive,
            onApply: applyLocationFilter,
            menuTitle: 'Filter by location',
            itemNoun: { singular: 'location', plural: 'locations' } }}
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
