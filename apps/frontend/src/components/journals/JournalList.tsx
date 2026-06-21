'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, MapPin, Clock, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JournalFormDrawer } from './JournalFormDrawer';
import { JournalLinkDrawer } from './JournalLinkDrawer';
import type { Journal } from '@/types/api';
import type { ApiClient } from '@/lib/api-client';

export interface JournalListProps {
  parentType: 'job' | 'quote' | 'invoice';
  parentId: string;
  api: ApiClient;
}

const ENTITY_TYPE_MAP: Record<string, string> = {
  job: 'Job',
  quote: 'Quote',
  invoice: 'Invoice',
};

export function JournalList({ parentType, parentId, api }: JournalListProps) {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);

  const entityType = ENTITY_TYPE_MAP[parentType];

  const loadJournals = () => {
    setLoading(true);
    api
      .getJournalsByEntity(entityType, parentId)
      .then((data) => setJournals(data))
      .catch((err) => console.error('JournalList.loadJournals:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJournals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentType, parentId]);

  const handleCreatedAndLinked = (journal: Journal) => {
    setJournals((prev) => [journal, ...prev]);
    setCreateDrawerOpen(false);
  };

  const handleLinked = () => {
    loadJournals();
    setLinkDrawerOpen(false);
  };

  const handleUnlink = async (journalId: string) => {
    try {
      await api.unlinkJournalFromEntity(journalId, entityType, parentId);
      setJournals((prev) => prev.filter((j) => j.id !== journalId));
    } catch (err) {
      console.error('JournalList.handleUnlink:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {journals.length} {journals.length === 1 ? 'journal' : 'journals'}
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLinkDrawerOpen(true)}>
            <Link2 className="mr-1 size-4" />
            Link Existing
          </Button>
          <Button size="sm" onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="mr-1 size-4" />
            New Journal
          </Button>
        </div>
      </div>

      {journals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BookOpen className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No journals linked</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLinkDrawerOpen(true)}>
              <Link2 className="mr-1 size-4" />
              Link Existing Journal
            </Button>
            <Button size="sm" onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="mr-1 size-4" />
              Create New Journal
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {journals.map((journal) => (
            <Card
              key={journal.id}
              className="group relative cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/journals/${journal.id}`)}
            >
              <CardContent className="p-4">
                {journal.thumbnailUrl && (
                  <div className="mb-3 h-32 overflow-hidden rounded-md bg-muted">
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
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(journal.latitude || journal.addressSuburb) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {journal.addressSuburb ?? 'Located'}
                      </span>
                    )}
                    {journal.pageCount != null && (
                      <span>{journal.pageCount} {journal.pageCount === 1 ? 'page' : 'pages'}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(journal.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="absolute right-2 top-2 hidden rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                  title="Unlink journal"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnlink(journal.id);
                  }}
                >
                  <Unlink className="size-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <JournalFormDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        entityType={entityType}
        entityId={parentId}
        api={api}
        onCreated={handleCreatedAndLinked}
      />

      <JournalLinkDrawer
        open={linkDrawerOpen}
        onOpenChange={setLinkDrawerOpen}
        entityType={entityType}
        entityId={parentId}
        api={api}
        onLinked={handleLinked}
      />
    </div>
  );
}
