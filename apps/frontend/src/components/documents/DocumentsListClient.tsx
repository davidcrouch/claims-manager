'use client';

import { useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SearchInput,
  ListEmptyState,
} from '@/components/shared/list-filters';

export function DocumentsListClient() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={FolderOpen}
          title="Documents"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SearchInput
            placeholder="Search documents by name or type..."
            value={search}
            onChange={setSearch}
          />
          <Button size="sm" className="shrink-0">
            <Upload className="mr-1 h-4 w-4" />
            Upload Document
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Uploaded</th>
                <th scope="col" className="px-4 py-3">Size</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Data rows will render here once the documents API is connected */}
            </tbody>
          </table>
        </div>
        <ListEmptyState label="No documents yet. Documents will appear here once the documents API is connected." />
      </div>
    </div>
  );
}
