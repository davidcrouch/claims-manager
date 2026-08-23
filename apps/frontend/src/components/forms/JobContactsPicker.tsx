'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Loader2, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  fetchContactTypeLookupsAction,
  searchContactsAction,
} from '@/app/(app)/mutations';
import type { Contact } from '@/types/api';

export type JobContactRef = {
  key: string;
  contactId?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
};

export type ContactSearchHit = {
  id: string;
  type: 'USER' | 'CONTACT';
  name: string;
  email?: string;
  mobilePhone?: string;
};

type ContactTypeLookup = {
  id: string;
  name?: string;
  externalReference?: string;
};

/** Match lookup externalReference against a bare or seed-prefixed ref. */
export function contactTypeRefMatches(
  externalReference: string | undefined,
  ref: string,
): boolean {
  if (!externalReference || !ref) return false;
  if (externalReference === ref) return true;
  if (externalReference === `seed-${ref}`) return true;
  return false;
}

export function contactFromSearchHit(hit: ContactSearchHit): JobContactRef {
  const [firstName, ...rest] = hit.name.split(' ');
  return {
    key: `existing-${hit.id}`,
    contactId: hit.id,
    firstName: firstName || hit.name,
    lastName: rest.join(' ') || undefined,
    email: hit.email,
    mobilePhone: hit.mobilePhone,
  };
}

export function contactFromCreated(contact: Contact): JobContactRef {
  return {
    key: `existing-${contact.id}`,
    contactId: contact.id,
    firstName: contact.firstName?.trim() || 'Contact',
    lastName: contact.lastName?.trim() || undefined,
    email: contact.email?.trim() || undefined,
    mobilePhone: contact.mobilePhone?.trim() || undefined,
  };
}

export function JobContactsPicker({
  contacts,
  onAdd,
  onRemove,
  onNewContact,
  excludeIds = [],
  lockedKeys,
  description = 'Search existing contacts or add a new one. Contacts are optional.',
  newContactLabel = 'New contact',
  defaultTypeRefs,
}: {
  contacts: JobContactRef[];
  onAdd: (contact: JobContactRef) => void;
  onRemove: (key: string) => void;
  onNewContact: () => void;
  /** Contact IDs that should not appear in search results (e.g. already on the job). */
  excludeIds?: string[];
  /** Row keys that cannot be removed (e.g. previously linked contacts). */
  lockedKeys?: ReadonlySet<string>;
  description?: string;
  newContactLabel?: string;
  /**
   * Optional default contact-type filter (lookup externalReference values,
   * e.g. `contact-type-vendor` or `seed-contact-type-vendor`).
   * When omitted, all types are included (unrestricted search).
   */
  defaultTypeRefs?: string[];
}) {
  const selectedIds = [
    ...excludeIds,
    ...contacts.map((c) => c.contactId).filter(Boolean) as string[],
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Add contacts</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ContactSearchField
              selectedIds={selectedIds}
              onSelect={(hit) => onAdd(contactFromSearchHit(hit))}
              defaultTypeRefs={defaultTypeRefs}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onNewContact}
            className="h-9 shrink-0 gap-1.5 bg-blue-600 text-white hover:bg-blue-500"
          >
            <UserPlus className="h-4 w-4" />
            {newContactLabel}
          </Button>
        </div>
      </div>

      {contacts.length > 0 && (
        <ul className="space-y-2">
          {contacts.map((c) => {
            const locked = lockedKeys?.has(c.key) ?? false;
            return (
              <li
                key={c.key}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">
                      {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                    </span>
                  </div>
                  {(c.email || c.mobilePhone) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-muted-foreground">
                      {c.email && <span>{c.email}</span>}
                      {c.mobilePhone && <span>{c.mobilePhone}</span>}
                    </div>
                  )}
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onRemove(c.key)}
                    className="rounded p-1 hover:bg-destructive/10"
                    aria-label="Remove contact"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ContactSearchField({
  selectedIds,
  onSelect,
  defaultTypeRefs,
}: {
  selectedIds: string[];
  onSelect: (hit: ContactSearchHit) => void;
  defaultTypeRefs?: string[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contactTypes, setContactTypes] = useState<ContactTypeLookup[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultsAppliedRef = useRef(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await fetchContactTypeLookupsAction();
      if (cancelled) return;
      setContactTypes(rows);
      if (!defaultsAppliedRef.current) {
        defaultsAppliedRef.current = true;
        if (defaultTypeRefs && defaultTypeRefs.length > 0) {
          const matched = new Set(
            rows
              .filter((t) =>
                defaultTypeRefs.some((ref) =>
                  contactTypeRefMatches(t.externalReference, ref),
                ),
              )
              .map((t) => t.id),
          );
          setSelectedTypeIds(matched.size > 0 ? matched : new Set(rows.map((t) => t.id)));
        } else {
          setSelectedTypeIds(new Set(rows.map((t) => t.id)));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultTypeRefs]);

  const allTypeIds = useMemo(
    () => new Set(contactTypes.map((t) => t.id)),
    [contactTypes],
  );

  const typeFilterIds = useMemo(() => {
    if (!selectedTypeIds || contactTypes.length === 0) return undefined;
    // All selected → unrestricted (includes contacts with no type).
    if (
      selectedTypeIds.size === 0 ||
      (selectedTypeIds.size === allTypeIds.size &&
        [...allTypeIds].every((id) => selectedTypeIds.has(id)))
    ) {
      return selectedTypeIds.size === 0 ? [] : undefined;
    }
    return [...selectedTypeIds];
  }, [selectedTypeIds, contactTypes.length, allTypeIds]);

  const filterLabel = useMemo(() => {
    if (!selectedTypeIds || contactTypes.length === 0) return 'Types';
    if (selectedTypeIds.size === 0) return 'Types: none';
    if (selectedTypeIds.size === contactTypes.length) return 'All types';
    if (selectedTypeIds.size === 1) {
      const id = [...selectedTypeIds][0];
      const t = contactTypes.find((c) => c.id === id);
      return t?.name ?? t?.externalReference ?? 'Types';
    }
    return `${selectedTypeIds.size} types`;
  }, [selectedTypeIds, contactTypes]);

  function runSearch(value: string, typeIds: string[] | undefined) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    // Explicit empty selection → no results.
    if (typeIds && typeIds.length === 0) {
      setResults([]);
      setShowDropdown(true);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchContactsAction(value.trim(), {
          typeLookupIds: typeIds,
        });
        const selected = new Set(selectedIds);
        const tokens = value
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        setResults(
          (res ?? []).filter((r) => {
            if (selected.has(r.id)) return false;
            const hay =
              `${r.name} ${r.email ?? ''} ${r.mobilePhone ?? ''}`.toLowerCase();
            return tokens.every((t) => hay.includes(t));
          }),
        );
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleSearch(value: string) {
    setQuery(value);
    runSearch(value, typeFilterIds);
  }

  function toggleType(id: string, checked: boolean) {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev ?? []);
      if (checked) next.add(id);
      else next.delete(id);
      // Re-search with the new selection when a query is active.
      const nextFilter =
        next.size === 0
          ? []
          : next.size === allTypeIds.size &&
              [...allTypeIds].every((tid) => next.has(tid))
            ? undefined
            : [...next];
      if (query.trim().length >= 1) {
        runSearch(query, nextFilter);
      }
      return next;
    });
  }

  function selectAllTypes() {
    const next = new Set(contactTypes.map((t) => t.id));
    setSelectedTypeIds(next);
    if (query.trim().length >= 1) runSearch(query, undefined);
  }

  function clearAllTypes() {
    setSelectedTypeIds(new Set());
    if (query.trim().length >= 1) {
      setResults([]);
      setShowDropdown(true);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1" ref={containerRef}>
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search contacts by name or email..."
            className="pl-8"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {showDropdown && results.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onSelect(r);
                      setQuery('');
                      setResults([]);
                      setShowDropdown(false);
                    }}
                  >
                    <span className="font-medium">{r.name}</span>
                    {r.email && (
                      <span className="text-muted-foreground">{r.email}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showDropdown && !searching && results.length === 0 && query.trim().length >= 1 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
              No contacts found. Try a different name or email, or add a new contact below.
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={contactTypes.length === 0}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            <Filter className="h-3.5 w-3.5" />
            {filterLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px] p-2">
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-medium text-slate-500">Contact types</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={selectAllTypes}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearAllTypes}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="max-h-[280px] space-y-0.5 overflow-y-auto">
              {contactTypes.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={selectedTypeIds?.has(t.id) ?? false}
                  onCheckedChange={(checked) => toggleType(t.id, checked === true)}
                  className="cursor-pointer"
                >
                  {t.name ?? t.externalReference ?? t.id}
                </DropdownMenuCheckboxItem>
              ))}
              {contactTypes.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-slate-400">No contact types loaded</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
