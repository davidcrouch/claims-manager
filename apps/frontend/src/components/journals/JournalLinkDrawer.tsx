'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Search, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Journal } from '@/types/api';
import type { ApiClient } from '@/lib/api-client';

export interface JournalLinkDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  api: ApiClient;
  onLinked?: () => void;
}

export function JournalLinkDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  api,
  onLinked,
}: JournalLinkDrawerProps) {
  const [search, setSearch] = useState('');
  const [allJournals, setAllJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .getJournals({ limit: 100, status: 'active' })
      .then((res) => setAllJournals(res.data))
      .catch((err) => console.error('JournalLinkDrawer.load:', err))
      .finally(() => setLoading(false));
  }, [open, api]);

  const filtered = allJournals.filter(
    (j) =>
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      (j.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleLink = async (journalId: string) => {
    setLinkingId(journalId);
    try {
      await api.linkJournalToEntity(journalId, entityType, entityId);
      onLinked?.();
    } catch (err) {
      console.error('JournalLinkDrawer.handleLink:', err);
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Link Existing Journal</SheetTitle>
          <SheetDescription>
            Search and select a journal to link to this {entityType.toLowerCase()}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search journals…"
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <BookOpen className="size-8 text-muted-foreground/40" />
              <p>No journals found</p>
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {filtered.map((journal) => (
                <div
                  key={journal.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{journal.name}</p>
                    {journal.description && (
                      <p className="truncate text-xs text-muted-foreground">{journal.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={linkingId === journal.id}
                    onClick={() => handleLink(journal.id)}
                  >
                    <Link2 className="mr-1 size-3.5" />
                    {linkingId === journal.id ? 'Linking…' : 'Link'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
