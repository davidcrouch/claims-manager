'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, MapPin, Clock, Plus, MoreHorizontal, Archive, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { JournalFormDrawer } from './JournalFormDrawer';
import { useApiClient } from '@/hooks/useApiClient';
import type { Journal, PaginatedResponse } from '@/types/api';

export interface JournalsPageClientProps {
  initialData: PaginatedResponse<Journal> | { data: Journal[]; total: number };
}

export function JournalsPageClient({ initialData }: JournalsPageClientProps) {
  const router = useRouter();
  const api = useApiClient();
  const [journals, setJournals] = useState<Journal[]>(
    'data' in initialData ? initialData.data : [],
  );
  const [search, setSearch] = useState('');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const filtered = journals.filter((j) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.name.toLowerCase().includes(q) ||
      (j.description ?? '').toLowerCase().includes(q)
    );
  });

  const handleCreated = (journal: Journal) => {
    setJournals((prev) => [journal, ...prev]);
    setCreateDrawerOpen(false);
  };

  const handleArchive = async (journalId: string) => {
    try {
      await api.updateJournal(journalId, { status: 'archived' });
      setJournals((prev) => prev.map((j) => (j.id === journalId ? { ...j, status: 'archived' } : j)));
    } catch (err) {
      console.error('JournalsPageClient.handleArchive:', err);
    }
  };

  const handleDelete = async (journalId: string) => {
    try {
      await api.deleteJournal(journalId);
      setJournals((prev) => prev.filter((j) => j.id !== journalId));
    } catch (err) {
      console.error('JournalsPageClient.handleDelete:', err);
    }
  };

  if (journals.length === 0 && !search) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <BookOpen className="size-12 text-muted-foreground/40" />
        <h2 className="text-lg font-medium">No journals</h2>
        <p className="text-sm text-muted-foreground">
          Create journals here, then link them to Jobs, Estimates, or Invoices.
        </p>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-1 size-4" />
          New Journal
        </Button>
        <JournalFormDrawer
          open={createDrawerOpen}
          onOpenChange={setCreateDrawerOpen}
          api={api}
          onCreated={handleCreated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search journals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-1 size-4" />
          New Journal
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((journal) => (
          <Card
            key={journal.id}
            className="group relative cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => router.push(`/journals/${journal.id}`)}
          >
            <CardContent className="p-4">
              {journal.thumbnailUrl && (
                <div className="mb-3 h-28 overflow-hidden rounded-md bg-muted">
                  <img
                    src={journal.thumbnailUrl}
                    alt={journal.name}
                    className="size-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium leading-tight">{journal.name}</h4>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {journal.status}
                  </Badge>
                </div>
                {journal.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {journal.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {journal.entityLinks?.map((link) => (
                    <Badge key={link.id} variant="outline" className="text-[10px]">
                      {link.entityType}
                    </Badge>
                  ))}
                  {(journal.latitude || journal.addressSuburb) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {journal.addressSuburb ?? 'Located'}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(journal.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="absolute right-2 top-2 hidden rounded-md p-1 text-muted-foreground hover:bg-muted group-hover:block"
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleArchive(journal.id)}>
                    <Archive className="mr-2 size-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(journal.id)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>

      <JournalFormDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        api={api}
        onCreated={handleCreated}
      />
    </div>
  );
}
