'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { CalendarPlus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentFormDrawer, type JobParty } from '@/components/forms/AppointmentFormDrawer';
import { AppointmentsTable } from '@/components/appointments/AppointmentsTable';
import { appointmentStatusLabel, appointmentTypeName } from '@/components/appointments/AppointmentsTable';
import { fetchJobAppointmentsAction } from '@/app/(app)/jobs/[id]/actions';
import { ValueFilterMenu } from '@/components/shared/list-filters';
import type { Appointment, Job } from '@/types/api';

type ListTab = 'all' | 'scheduled' | 'cancelled';

export function JobAppointmentsTab({ jobId, job }: { jobId: string; job: Job }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const [tab, setTab] = useState<ListTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobAppointmentsAction(jobId);
      setAppointments(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const jobParties = ((job.apiPayload as Record<string, unknown>)?.contacts as JobParty[]) ?? [];

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

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const a of appointments) {
      const n = appointmentTypeName(a).trim();
      if (n && n !== '—') names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [appointments]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = appointments;

    if (tab === 'scheduled') rows = rows.filter((a) => appointmentStatusLabel(a) !== 'Cancelled');
    else if (tab === 'cancelled') rows = rows.filter((a) => appointmentStatusLabel(a) === 'Cancelled');

    if (typeFilter.size > 0) {
      rows = rows.filter((a) => {
        const n = appointmentTypeName(a).trim();
        return n && n !== '—' ? typeFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((a) => {
        const name = (a.name ?? '').toLowerCase();
        const loc = (a.location ?? '').toLowerCase();
        return name.includes(query) || loc.includes(query);
      });
    }

    return rows;
  }, [appointments, tab, typeFilter, debouncedSearch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search appointments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <ValueFilterMenu
          options={uniqueTypes}
          selected={typeFilter}
          onToggle={toggleType}
          onClearAll={() => setTypeFilter(new Set())}
          onSelectAll={() => setTypeFilter(new Set(uniqueTypes))}
          emptyLabel="All types"
          menuTitle="Filter by type"
          itemNoun={{ singular: 'type', plural: 'types' }}
        />

        <Button onClick={handleCreate} size="sm">
          <CalendarPlus className="h-4 w-4 mr-2" />
          Create Appointment
        </Button>
      </div>

      <AppointmentFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        jobId={jobId}
        jobParties={jobParties}
        appointment={editingAppointment ?? undefined}
      />

      <AppointmentsTable
        appointments={visibleRows}
        loading={loading}
        onRowClick={handleRowClick}
        emptyLabel="No appointments found."
      />
    </div>
  );
}
