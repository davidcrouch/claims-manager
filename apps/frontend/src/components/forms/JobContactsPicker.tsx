'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchContactsAction } from '@/app/(app)/mutations';
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

function ContactSearchField({
  selectedIds,
  onSelect,
}: {
  selectedIds: string[];
  onSelect: (hit: ContactSearchHit) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchContactsAction(value.trim());
        const selected = new Set(selectedIds);
        setResults((res ?? []).filter((r) => !selected.has(r.id)));
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  return (
    <div className="relative" ref={containerRef}>
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
      {showDropdown && !searching && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          No contacts found. Try a different name or email, or add a new contact below.
        </div>
      )}
    </div>
  );
}
