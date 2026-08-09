'use client';

import { useState } from 'react';
import { LayoutList, Plus, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { JournalOverview } from './JournalOverview';
import { JournalEntriesPanel } from './JournalEntriesPanel';
import { PageEntryDrawer } from './PageEntryDrawer';
import { useApiClient } from '@/hooks/useApiClient';
import type { Job, Journal, JournalPage } from '@/types/api';

export interface JournalDetailClientProps {
  journal: Journal;
  initialPages: { data: JournalPage[]; total: number };
  job?: Job | null;
}

export function JournalDetailClient({ journal, initialPages, job = null }: JournalDetailClientProps) {
  const api = useApiClient();
  const [pages, setPages] = useState<JournalPage[]>(initialPages.data);
  const [totalCount, setTotalCount] = useState(initialPages.total);
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    initialPages.data[0]?.id ?? null,
  );

  const handlePageCreated = (page: JournalPage) => {
    setPages((prev) => [...prev, page]);
    setTotalCount((prev) => prev + 1);
    setSelectedPageId(page.id);
    setActiveTab('entries');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SetHeaderActions>
        {api && (
          <Button
            size="default"
            onClick={() => setEntryDrawerOpen(true)}
            className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        )}
        <PrintButton documentType="journal" entityId={journal.id} jobId={job?.id} />
        <ArchiveEntityButton
          entityType="journal"
          entityId={journal.id}
          statusName={journal.status}
          entityLabel={journal.name}
          redirectTo="/journals"
        />
      </SetHeaderActions>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(String(val))}
        className="gap-4"
      >
        <TabsList variant="line" className="w-full max-w-md">
          <TabsTrigger value="overview" className="flex-1 gap-1.5">
            <ScrollText className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="entries" className="flex-1 gap-1.5">
            <LayoutList className="size-3.5" />
            Entries
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {totalCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="outline-none">
          <JournalOverview journal={journal} entryCount={totalCount} job={job} />
        </TabsContent>

        <TabsContent value="entries" className="outline-none">
          <JournalEntriesPanel
            pages={pages}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            onAddEntry={api ? () => setEntryDrawerOpen(true) : undefined}
          />
        </TabsContent>
      </Tabs>

      {api && (
        <PageEntryDrawer
          open={entryDrawerOpen}
          onOpenChange={setEntryDrawerOpen}
          journalId={journal.id}
          api={api}
          onCreated={handlePageCreated}
        />
      )}
    </div>
  );
}
