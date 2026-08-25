'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutList, Plus, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { JournalOverview } from './JournalOverview';
import { JournalEntriesPanel } from './JournalEntriesPanel';
import { PageEntryDrawer } from './PageEntryDrawer';
import { useApiClient } from '@/hooks/useApiClient';
import type { Job, Journal, JournalPage } from '@/types/api';

const VALID_TABS = ['overview', 'entries'] as const;
type TabValue = (typeof VALID_TABS)[number];

function normaliseTab(raw: string | null): TabValue {
  if (!raw) return 'overview';
  return VALID_TABS.find((t) => t === raw) ?? 'overview';
}

export interface JournalDetailClientProps {
  journal: Journal;
  initialPages: { data: JournalPage[]; total: number };
  job?: Job | null;
}

export function JournalDetailClient({ journal, initialPages, job = null }: JournalDetailClientProps) {
  const api = useApiClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normaliseTab(searchParams.get('tab'));
  const [pages, setPages] = useState<JournalPage[]>(initialPages.data);
  const [totalCount, setTotalCount] = useState(initialPages.total);
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    initialPages.data[0]?.id ?? null,
  );

  const onTabChange = useCallback(
    (value: TabValue) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === 'overview') {
        sp.delete('tab');
      } else {
        sp.set('tab', value);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handlePageCreated = (page: JournalPage) => {
    setPages((prev) => [...prev, page]);
    setTotalCount((prev) => prev + 1);
    setSelectedPageId(page.id);
    onTabChange('entries');
  };

  const tabs: Array<{ id: TabValue; label: string; icon: typeof ScrollText; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: ScrollText },
    { id: 'entries', label: 'Entries', icon: LayoutList, count: totalCount },
  ];

  return (
    <div className="flex flex-col">
      <SetHeaderActions>
        {api && (
          <Button
            size="default"
            onClick={() => setEntryDrawerOpen(true)}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        )}
        <HeaderActionToolbar>
          <PrintButton documentType="journal" entityId={journal.id} jobId={job?.id} />
          <ArchiveEntityButton
            entityType="journal"
            entityId={journal.id}
            statusName={journal.status}
            entityLabel={journal.name}
            redirectTo="/journals"
          />
        </HeaderActionToolbar>
      </SetHeaderActions>

      <div className="flex w-full flex-wrap items-center gap-x-4 border-b border-slate-200">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                  active
                    ? 'border-sky-600 bg-sky-50 text-sky-600'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count != null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4">
        {activeTab === 'overview' && (
          <JournalOverview journal={journal} entryCount={totalCount} job={job} />
        )}
        {activeTab === 'entries' && (
          <JournalEntriesPanel
            pages={pages}
            selectedPageId={selectedPageId}
            onSelectPage={setSelectedPageId}
            onAddEntry={api ? () => setEntryDrawerOpen(true) : undefined}
          />
        )}
      </div>

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
