'use client';

import { Search, X, Upload, LayoutGrid, List, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface DocumentsToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  layout: 'grid' | 'list';
  onLayoutChange: (layout: 'grid' | 'list') => void;
  onUpload: () => void;
  mimeFilter?: string;
  onMimeFilterChange?: (mime: string | undefined) => void;
}

const MIME_GROUPS = [
  { label: 'Images', value: 'image/' },
  { label: 'Videos', value: 'video/' },
  { label: 'Audio', value: 'audio/' },
  { label: 'PDFs', value: 'application/pdf' },
  { label: 'Documents', value: 'document' },
  { label: 'Spreadsheets', value: 'spreadsheet' },
];

export function DocumentsToolbar({
  search,
  onSearch,
  layout,
  onLayoutChange,
  onUpload,
  mimeFilter,
  onMimeFilterChange,
}: DocumentsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input
          placeholder="Search documents…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-9 w-full pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onMimeFilterChange && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MIME_GROUPS.map((group) => (
                <DropdownMenuCheckboxItem
                  key={group.value}
                  checked={mimeFilter === group.value}
                  onCheckedChange={(checked) =>
                    onMimeFilterChange(checked ? group.value : undefined)
                  }
                >
                  {group.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => onLayoutChange('grid')}
            className={cn(
              'flex h-8 w-8 items-center justify-center transition-colors',
              layout === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange('list')}
            className={cn(
              'flex h-8 w-8 items-center justify-center transition-colors',
              layout === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600',
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        <Button size="sm" onClick={onUpload} className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>
    </div>
  );
}
