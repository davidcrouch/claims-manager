'use client';

import { useMemo, useState, useEffect } from 'react';
import { Mail, Phone, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  ValueFilterMenu,
  SortableColumnHeader,
  compareValues,
} from '@/components/shared/list-filters';
import type { Job } from '@/types/api';

type Dict = Record<string, unknown>;

interface ContactRow {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  type?: string | { name?: string; externalReference?: string };
  preferredMethodOfContact?: string | { name?: string };
  notes?: string;
}

function contactName(c: ContactRow): string {
  if (c.name) return c.name;
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.join(' ').trim() || '—';
}

function contactType(c: ContactRow): string {
  if (!c.type) return '—';
  if (typeof c.type === 'string') return c.type;
  return c.type.name ?? c.type.externalReference ?? '—';
}

function preferredMethod(c: ContactRow): string {
  if (!c.preferredMethodOfContact) return '—';
  if (typeof c.preferredMethodOfContact === 'string') {
    return c.preferredMethodOfContact;
  }
  return c.preferredMethodOfContact.name ?? '—';
}

type ContactSortField = 'name' | 'type' | 'email' | 'preferred';

interface ColDef { key: ContactSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'email', label: 'Email' },
  { key: 'preferred', label: 'Preferred' },
];

function getSortValue(c: ContactRow, field: ContactSortField): string | null | undefined {
  switch (field) {
    case 'name': return contactName(c);
    case 'type': return contactType(c);
    case 'email': return c.email;
    case 'preferred': return preferredMethod(c);
    default: return null;
  }
}

export function JobPartiesTab({ job }: { job: Job }) {
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const contacts = (api.contacts as ContactRow[] | undefined) ?? [];

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: ContactSortField; order: 'asc' | 'desc' }>({
    field: 'name',
    order: 'asc',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: ContactSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: 'asc' };
    });
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const c of contacts) {
      const t = contactType(c).trim();
      if (t && t !== '—') names.add(t);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = contacts;

    if (typeFilter.size > 0) {
      rows = rows.filter((c) => {
        const t = contactType(c).trim();
        return t && t !== '—' ? typeFilter.has(t) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((c) => {
        const name = contactName(c).toLowerCase();
        const email = (c.email ?? '').toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }

    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return compareValues(aVal, bVal, columnSort.order);
    });
  }, [contacts, typeFilter, debouncedSearch, columnSort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search contacts..."
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
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No contacts found.</p>
          </div>
        </div>
      ) : (
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
                <th scope="col" className="px-4 py-3">Phones</th>
                <th scope="col" className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((c, i) => (
                <tr key={c.id ?? i} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{contactName(c)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {contactType(c)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {preferredMethod(c)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {c.mobilePhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {c.mobilePhone}
                          <span className="text-slate-400">(M)</span>
                        </span>
                      )}
                      {c.homePhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {c.homePhone}
                          <span className="text-slate-400">(H)</span>
                        </span>
                      )}
                      {c.workPhone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {c.workPhone}
                          <span className="text-slate-400">(W)</span>
                        </span>
                      )}
                      {!c.mobilePhone && !c.homePhone && !c.workPhone && (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.notes ?? <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
