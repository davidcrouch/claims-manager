'use client';

/**
 * Shared toolbar primitives and helpers for entity list pages.
 * Used by ClaimsListClient and the other entity list clients to ensure
 * identical search/sort/status filter UX across the app.
 */

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface StatusOption {
  id: string;
  name: string;
}

export interface SortOption {
  key: string;
  label: string;
}

/**
 * Parse a `${field}_${order}` sort string into a typed tuple, falling back
 * to the provided default when the value is missing or not in the allowlist.
 */
export function parseSort(params: {
  sortParam: string | null;
  allowedFields: string[];
  defaultField: string;
  defaultOrder?: 'asc' | 'desc';
}): { field: string; order: 'asc' | 'desc' } {
  const { sortParam, allowedFields, defaultField } = params;
  const defaultOrder = params.defaultOrder ?? 'desc';
  if (!sortParam) return { field: defaultField, order: defaultOrder };
  const idx = sortParam.lastIndexOf('_');
  if (idx <= 0) return { field: defaultField, order: defaultOrder };
  const order = sortParam.slice(idx + 1);
  const field = sortParam.slice(0, idx);
  if (order !== 'asc' && order !== 'desc') {
    return { field: defaultField, order: defaultOrder };
  }
  if (!allowedFields.includes(field)) {
    return { field: defaultField, order: defaultOrder };
  }
  return { field, order };
}

export function buildSortString(field: string, order: 'asc' | 'desc'): string {
  return `${field}_${order}`;
}

export function statusIdsKey(ids: Set<string>): string {
  return [...ids].sort().join(',');
}

export function parseStatusIdsFromSearchParam(
  param: string | null,
): Set<string> {
  if (!param) return new Set();
  return new Set(
    param
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function SortButton(props: {
  field: string;
  label: string;
  activeField: string;
  sortOrder: 'asc' | 'desc' | string;
  onSort: (field: string) => void;
}) {
  const { field, label, activeField, sortOrder, onSort } = props;
  const isActive = activeField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-slate-100 text-slate-900 shadow-sm'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {label}
      {isActive &&
        (sortOrder === 'asc' ? (
          <ArrowUp size={12} className="text-indigo-600" />
        ) : (
          <ArrowDown size={12} className="text-indigo-600" />
        ))}
    </button>
  );
}

export function SortTabs(props: {
  options: SortOption[];
  activeField: string;
  sortOrder: 'asc' | 'desc' | string;
  onSort: (field: string) => void;
}) {
  const { options, activeField, sortOrder, onSort } = props;
  return (
    <div className="flex items-center rounded-md border border-slate-200 bg-white p-1">
      {options.map((option) => (
        <SortButton
          key={option.key}
          field={option.key}
          label={option.label}
          activeField={activeField}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ))}
    </div>
  );
}

export function SearchInput(props: {
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { placeholder, value, onChange } = props;
  return (
    <div className="relative flex-1">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        size={16}
      />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function StatusFilterMenu(props: {
  options: StatusOption[];
  selected: Set<string>;
  onSelectionChange: (id: string, checked: boolean) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  /** Trigger label shown when no option is selected. Defaults to "All statuses". */
  triggerEmptyLabel?: string;
  /** Header text in the dropdown menu. Defaults to "Filter by status". */
  menuTitle?: string;
  /** Noun (singular) used to pluralise the selected count, e.g. "2 statuses". */
  itemNoun?: { singular: string; plural: string };
}) {
  const {
    options,
    selected,
    onSelectionChange,
    onClearAll,
    onSelectAll,
    triggerEmptyLabel = 'All statuses',
    menuTitle = 'Filter by status',
    itemNoun = { singular: 'status', plural: 'statuses' },
  } = props;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-[140px] cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white py-2 pl-3 pr-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500">
        <span className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {selected.size === 0
            ? triggerEmptyLabel
            : `${selected.size} ${
                selected.size === 1 ? itemNoun.singular : itemNoun.plural
              }`}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[220px] p-2" align="end">
        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-medium text-slate-500">
            {menuTitle}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs text-indigo-600 hover:underline"
            >
              All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-indigo-600 hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-[280px] space-y-0.5 overflow-y-auto">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.id}
              checked={selected.has(opt.id)}
              onCheckedChange={(checked) =>
                onSelectionChange(opt.id, checked === true)
              }
              className="cursor-pointer"
            >
              {opt.name}
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">
              No {itemNoun.singular} values loaded
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ListEmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
          <Search size={24} className="text-slate-400" />
        </div>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}

/**
 * Compare helper that handles nulls and string vs numeric values consistently
 * for client-side sorting of list rows.
 */
export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  order: 'asc' | 'desc',
): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  let cmp: number;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { numeric: true });
  }
  return order === 'asc' ? cmp : -cmp;
}

export function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  order: 'asc' | 'desc',
): number {
  const aT = a ? new Date(a).getTime() : NaN;
  const bT = b ? new Date(b).getTime() : NaN;
  const aEmpty = Number.isNaN(aT);
  const bEmpty = Number.isNaN(bT);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return order === 'asc' ? aT - bT : bT - aT;
}

export function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}
