'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Mail, Phone, Search, Trash2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow,
  compareValues,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
} from '@/components/shared/list-filters';
import { removeJobContactAction } from '@/app/(app)/jobs/mutations';
import { fetchContactsAction } from '@/app/(app)/contacts/actions';
import {
  createListFetchSession,
  useListFetchGate,
} from '@/components/shared/use-list-page-data';
import type { Contact, Job } from '@/types/api';

function contactName(c: Contact): string {
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.join(' ').trim() || '—';
}

function contactTypeName(
  c: Contact,
  typeOptions: Array<{ id: string; name?: string }>,
): string {
  if (!c.typeLookupId) return '—';
  return typeOptions.find((t) => t.id === c.typeLookupId)?.name ?? '—';
}

type ContactSortField = 'name' | 'type' | 'email' | 'preferred';

interface ColDef { key: ContactSortField; label: string; filterable?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type', filterable: true },
  { key: 'email', label: 'Email' },
  { key: 'preferred', label: 'Preferred' },
];

export function JobPartiesTab({
  job,
  typeOptions = [],
}: {
  job: Job;
  typeOptions?: Array<{ id: string; name?: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Contact | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [columnSort, setColumnSort] = useState<{ field: ContactSortField; order: 'asc' | 'desc' }>({
    field: 'name',
    order: 'asc',
  });
  const { beginFetch, abortFetch, invalidateFetch } = useListFetchGate();

  const typeParam = useMemo(
    () =>
      columnFilterToIdsParam(
        typeFilterActive,
        typeFilter,
        typeOptions.map((t) => ({ id: t.id, name: t.name?.trim() || 'Unknown' })),
      ),
    [typeFilterActive, typeFilter, typeOptions],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const typeKey = typeParam === null ? '__none__' : (typeParam ?? '');
    const fetchKey = `${job.id}|${debouncedSearch}|${typeKey}|${columnSort.field}_${columnSort.order}`;
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    if (typeParam === null) {
      setContacts([]);
      setLoading(false);
      return session.cleanup;
    }

    setLoading(true);
    fetchContactsAction({
      jobId: job.id,
      limit: 100,
      search: debouncedSearch || undefined,
      typeLookupIds: typeParam ? typeParam.split(',') : undefined,
      sort:
        columnSort.field === 'name' || columnSort.field === 'email'
          ? `${columnSort.field}_${columnSort.order}`
          : undefined,
    })
      .then((res) => {
        if (!session.cancelled) setContacts(res.data);
      })
      .finally(() => {
        if (!session.cancelled) setLoading(false);
      });
    return session.cleanup;
  }, [job.id, debouncedSearch, typeParam, columnSort, beginFetch, abortFetch]);

  function requestRemove(contact: Contact) {
    if (!contact.id) return;
    setRemoveError(null);
    setConfirmRemove(contact);
  }

  function openContactDetail(contact: Contact) {
    if (!contact.id) return;
    router.push(`/contacts/${contact.id}?fromJob=${job.id}`);
  }

  function confirmRemoveContact() {
    const contact = confirmRemove;
    if (!contact?.id) return;

    setRemovingId(contact.id);
    setRemoveError(null);
    startTransition(async () => {
      try {
        const result = await removeJobContactAction(job.id, contact.id!);
        if (!result.success) {
          setRemoveError(result.error ?? 'Failed to remove contact');
          return;
        }
        setConfirmRemove(null);
        invalidateFetch();
        router.refresh();
        setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      } finally {
        setRemovingId(null);
      }
    });
  }

  const handleColumnSort = (field: ContactSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: 'asc' };
    });
  };

  const uniqueTypes = useMemo(
    () =>
      [...new Set(typeOptions.map((t) => (t.name ?? '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [typeOptions],
  );

  const toggleType = (name: string) => {
    const working = typeFilterActive ? new Set(typeFilter) : new Set(uniqueTypes);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
  };

  const visibleRows = useMemo(() => {
    return [...contacts].sort((a, b) => {
      const getVal = (c: Contact): string | null | undefined => {
        switch (columnSort.field) {
          case 'name': return contactName(c);
          case 'type': return contactTypeName(c, typeOptions);
          case 'email': return c.email;
          case 'preferred': return null;
          default: return null;
        }
      };
      return compareValues(getVal(a), getVal(b), columnSort.order);
    });
  }, [contacts, columnSort, typeOptions]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

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
          selected={typeFilterActive ? typeFilter : new Set(uniqueTypes)}
          onToggle={toggleType}
          onClearAll={() => {
            setTypeFilter(new Set());
            setTypeFilterActive(false);
          }}
          onSelectAll={() => {
            setTypeFilter(new Set());
            setTypeFilterActive(false);
          }}
          emptyLabel="All types"
          menuTitle="Filter by type"
          itemNoun={{ singular: 'type', plural: 'types' }}
        />
      </div>

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
                    filter={
                      col.key === 'type'
                        ? {
                            options: uniqueTypes,
                            selected: typeFilter,
                            active: typeFilterActive,
                            onApply: applyTypeFilter,
                            menuTitle: 'Filter by type',
                            itemNoun: { singular: 'type', plural: 'types' },
                          }
                        : undefined
                    }
                  />
                ))}
                <th scope="col" className="px-4 py-3">Phones</th>
                <th scope="col" className="px-4 py-3">Notes</th>
                <th scope="col" className="w-12 px-2 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow colSpan={TABLE_COLUMNS.length + 3} label="No contacts found." />
              ) : (
              visibleRows.map((c, i) => {
                const busy = isPending && removingId === c.id;
                return (
                <tr
                  key={c.id ?? i}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => openContactDetail(c)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{contactName(c)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {contactTypeName(c, typeOptions)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">—</td>
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
                  <td className="px-2 py-3 text-right">
                    {c.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-destructive"
                        disabled={busy || (isPending && removingId !== null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestRemove(c);
                        }}
                        aria-label={`Remove ${contactName(c)} from job`}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                  </td>
                </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

      <Dialog
        open={confirmRemove !== null}
        onOpenChange={(open) => {
          if (!open && !(isPending && removingId !== null)) {
            setConfirmRemove(null);
            setRemoveError(null);
          }
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Remove contact</DialogTitle>
                <DialogDescription className="mt-1">
                  Remove{' '}
                  <span className="font-medium text-foreground">
                    {confirmRemove ? contactName(confirmRemove) : 'this contact'}
                  </span>{' '}
                  from this job? The contact record itself will not be deleted.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {removeError && (
            <p className="text-sm text-destructive">{removeError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isPending && removingId !== null}
              onClick={() => {
                setConfirmRemove(null);
                setRemoveError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending && removingId !== null}
              onClick={confirmRemoveContact}
            >
              {isPending && removingId !== null ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
