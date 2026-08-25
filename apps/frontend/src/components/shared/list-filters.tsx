'use client';

/**
 * Shared toolbar primitives and helpers for entity list pages.
 * Used by ClaimsListClient and the other entity list clients to ensure
 * identical search/sort/status filter UX across the app.
 */

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ChevronDown,
  Filter,
  Search,
  Square,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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

/**
 * Map selected display names to lookup IDs (comma-separated), suitable for
 * list API `status` / `jobType` query params. Empty selection → undefined (no filter).
 */
export function selectedNamesToIdsParam(
  selectedNames: Set<string>,
  options: { id: string; name: string }[],
): string | undefined {
  if (selectedNames.size === 0) return undefined;
  const ids: string[] = [];
  for (const opt of options) {
    const name = opt.name?.trim();
    if (name && selectedNames.has(name)) ids.push(opt.id);
  }
  if (ids.length === 0) return undefined;
  return [...new Set(ids)].sort().join(',');
}

/**
 * Commit draft checkbox selection from a column filter popup.
 * - None checked → active filter that matches nothing
 * - All checked → inactive (show all records)
 * - Partial → active filter for those names
 */
export function commitColumnFilterSelection(params: {
  next: Set<string>;
  optionCount: number;
}): { selected: Set<string>; active: boolean } {
  if (params.next.size === 0) {
    return { selected: new Set(), active: true };
  }
  if (params.optionCount > 0 && params.next.size >= params.optionCount) {
    return { selected: new Set(), active: false };
  }
  return { selected: new Set(params.next), active: true };
}

/** Sentinel label for null/empty column values in checkbox filters. */
export const COLUMN_FILTER_BLANK = '(Blank)';

/** Map a raw cell value to its filter option key (blank → COLUMN_FILTER_BLANK). */
export function columnFilterKey(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed || COLUMN_FILTER_BLANK;
}

/**
 * Build sorted filter options from raw cell values, always including (Blank)
 * when any empty/null value is present (or when `alwaysIncludeBlank` is true).
 */
export function buildColumnFilterOptions(
  values: Iterable<string | null | undefined>,
  opts?: { alwaysIncludeBlank?: boolean },
): string[] {
  const names = new Set<string>();
  let hasBlank = false;
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (!trimmed) hasBlank = true;
    else names.add(trimmed);
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  if (hasBlank || opts?.alwaysIncludeBlank) {
    return [COLUMN_FILTER_BLANK, ...sorted];
  }
  return sorted;
}

/**
 * Disambiguate duplicate display names so checkbox filters map 1:1 to ids
 * (same failure mode as Job column labels).
 */
export function withUniqueNamedFilterOptions<T extends { id: string; name: string }>(
  options: T[],
): T[] {
  const bases = options.map((o) => ({
    option: o,
    base: (o.name ?? '').trim() || o.id,
  }));
  const counts = new Map<string, number>();
  for (const row of bases) {
    counts.set(row.base, (counts.get(row.base) ?? 0) + 1);
  }
  return bases.map(({ option, base }) => ({
    ...option,
    name: (counts.get(base) ?? 0) > 1 ? `${base} (${option.id.slice(0, 8)})` : base,
  }));
}

/**
 * Build API filter param from applied column filter state.
 * - inactive → undefined (no query filter)
 * - active + empty → null (match nothing; caller should short-circuit to empty results)
 * - active + names → CSV ids
 */
export function columnFilterToIdsParam(
  active: boolean,
  selected: Set<string>,
  options: { id: string; name: string }[],
): string | undefined | null {
  if (!active) return undefined;
  if (selected.size === 0) return null;
  return selectedNamesToIdsParam(selected, options) ?? null;
}

/**
 * Assignee column filter → CSV user ids.
 * Selected (Blank) maps to `__blank__` (API IS NULL sentinel).
 */
export function columnFilterToAssigneeIdsParam(
  active: boolean,
  selected: Set<string>,
  assignees: { id: string; name: string }[],
): string | undefined | null {
  return columnFilterToIdsParam(active, selected, [
    { id: '__blank__', name: COLUMN_FILTER_BLANK },
    ...assignees,
  ]);
}

/**
 * Build CSV string param for non-lookup filters (e.g. task status strings).
 * Same active/empty semantics as columnFilterToIdsParam.
 */
export function columnFilterToValuesParam(
  active: boolean,
  selected: Set<string>,
): string | undefined | null {
  if (!active) return undefined;
  if (selected.size === 0) return null;
  return [...selected].sort().join(',');
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

/** Empty tbody row so list tables keep sortable/filterable headers when there are 0 records. */
export function TableEmptyRow({
  colSpan,
  label,
}: {
  colSpan: number;
  label: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-slate-400">
        {label}
      </td>
    </tr>
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

export const ARCHIVED_STATUS_NAMES = new Set(['archived', 'closed']);

export function isArchivedStatus(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    ARCHIVED_STATUS_NAMES.has(normalized) || normalized.startsWith('closed ')
  );
}

export type ArchiveListTab = 'active' | 'archived' | 'all';

const VALID_ARCHIVE_TABS = new Set<ArchiveListTab>(['active', 'archived', 'all']);

/** Parse `?tab=` for Active / Archived / All list pages. */
export function parseArchiveListTab(
  param: string | null | undefined,
): ArchiveListTab {
  if (param && VALID_ARCHIVE_TABS.has(param as ArchiveListTab)) {
    return param as ArchiveListTab;
  }
  return 'active';
}

/**
 * Status lookup IDs implied by Active / Archived / All tabs.
 * - all → undefined (no tab constraint)
 * - options not loaded yet (empty array) → undefined (defer filter; avoid empty Active)
 * - active/archived with no matching lookups → null (empty result set)
 */
export function statusIdsForArchiveListTab(
  tab: ArchiveListTab,
  statusOptions: { id: string; name: string }[],
): string | undefined | null {
  if (tab === 'all') return undefined;
  if (statusOptions.length === 0) return undefined;
  const ids = statusOptions
    .filter((s) => {
      const archived = isArchivedStatus(s.name);
      return tab === 'archived' ? archived : !archived;
    })
    .map((s) => s.id);
  return ids.length > 0 ? ids.sort().join(',') : null;
}

/**
 * String status values implied by Active / Archived / All tabs
 * (journals, assessments, etc.).
 * Empty `allStatuses` defers the tab filter (same as statusIdsForArchiveListTab).
 */
export function statusValuesForArchiveListTab(
  tab: ArchiveListTab,
  allStatuses: string[],
): string | undefined | null {
  if (tab === 'all') return undefined;
  if (allStatuses.length === 0) return undefined;
  const values = allStatuses.filter((s) => {
    const archived = isArchivedStatus(s);
    return tab === 'archived' ? archived : !archived;
  });
  return values.length > 0 ? [...values].sort().join(',') : null;
}

/**
 * Combine column status filter with tab-derived status IDs/values.
 * Column empty-selection (null) wins; otherwise intersect when both set.
 */
export function mergeStatusParamWithTab(
  columnStatus: string | undefined | null,
  tabStatus: string | undefined | null,
): string | undefined | null {
  if (columnStatus === null) return null;
  if (tabStatus === null) return null;
  if (!tabStatus) return columnStatus;
  if (!columnStatus) return tabStatus;
  const tabSet = new Set(
    tabStatus
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const intersect = columnStatus
    .split(',')
    .map((s) => s.trim())
    .filter((id) => id && tabSet.has(id));
  return intersect.length > 0 ? intersect.join(',') : null;
}

export type TaskListTab = 'open' | 'completed' | 'all';

/**
 * Status string values implied by Open / Completed / All task list tabs.
 * Open includes in-progress variants used by synced/local tasks; Completed is
 * terminal statuses. Values must match `tasks.status` text exactly (comma-CSV).
 */
export function statusValuesForTaskListTab(
  tab: TaskListTab,
): string | undefined {
  if (tab === 'all') return undefined;
  if (tab === 'completed') return 'Completed,Failed,Cancelled';
  return 'Open,In Progress,On Hold';
}

export function ValueFilterMenu(props: {
  options: string[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  emptyLabel?: string;
  menuTitle?: string;
  itemNoun?: { singular: string; plural: string };
}) {
  const {
    options,
    selected,
    onToggle,
    onClearAll,
    onSelectAll,
    emptyLabel = 'All',
    menuTitle = 'Filter',
    itemNoun = { singular: 'item', plural: 'items' },
  } = props;
  const filterActive = selected.size > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-[220px] cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white py-2 pl-3 pr-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500">
        <span className="truncate">
          {selected.size === 0
            ? emptyLabel
            : selected.size === 1
              ? [...selected][0]
              : `${selected.size} ${itemNoun.plural}`}
        </span>
        {filterActive ? (
          <Filter size={14} className="ml-1 shrink-0 text-amber-500" />
        ) : (
          <ChevronDown size={14} className="ml-1 shrink-0 text-slate-400" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[320px]" align="end">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {menuTitle}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              All
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              None
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[280px] overflow-y-auto">
          {options.map((name) => {
            const isChecked = selected.has(name);
            return (
              <DropdownMenuItem
                key={name}
                onClick={(e) => {
                  e.preventDefault();
                  onToggle(name);
                }}
                closeOnClick={false}
                className="justify-between"
              >
                <span className={cn('text-sm', !isChecked && 'text-slate-400')}>
                  {name}
                </span>
                {isChecked ? (
                  <CheckSquare className="h-4 w-4 shrink-0 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </DropdownMenuItem>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">
              No {itemNoun.singular} values
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ColumnValueFilter {
  options: string[];
  /** Currently applied selection (empty when inactive or when matching nothing). */
  selected: Set<string>;
  /**
   * When false (default if omitted and selected empty), filter is inactive — show all.
   * When true, only checked values are included; empty selected means no matches.
   */
  active?: boolean;
  /** Called only when the user clicks Apply — not on individual checkbox changes. */
  onApply: (next: Set<string>) => void;
  menuTitle?: string;
  itemNoun?: { singular: string; plural: string };
}

function ColumnFilterButton(props: ColumnValueFilter) {
  const {
    options,
    selected,
    active = false,
    onApply,
    menuTitle = 'Filter',
    itemNoun = { singular: 'item', plural: 'items' },
  } = props;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(selected));

  useEffect(() => {
    if (!open) return;
    // Inactive filter → open with all checked. Active → reflect applied selection.
    if (!active) {
      setDraft(new Set(options));
    } else {
      setDraft(new Set(selected));
    }
  }, [open, active, selected, options]);

  const toggleDraft = (name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleApply = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onApply(new Set(draft));
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={menuTitle}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded p-0.5 transition-colors hover:bg-slate-200/80',
              active ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Filter size={12} />
          </button>
        }
      />
      <DropdownMenuContent
        className="min-w-[220px]"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {menuTitle}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraft(new Set(options));
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              All
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraft(new Set());
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              None
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[280px] overflow-y-auto">
          {options.map((name) => {
            const isChecked = draft.has(name);
            return (
              <DropdownMenuItem
                key={name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleDraft(name);
                }}
                closeOnClick={false}
                className="justify-between"
              >
                <span className={cn('text-sm', !isChecked && 'text-slate-400')}>
                  {name}
                </span>
                {isChecked ? (
                  <CheckSquare className="h-4 w-4 shrink-0 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </DropdownMenuItem>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">
              No {itemNoun.singular} values
            </p>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <button
            type="button"
            onClick={handleApply}
            className="w-full rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            Apply
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SortableColumnHeader<K extends string>(props: {
  columnKey: K;
  label: string;
  activeField: K | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: K) => void;
  /** When set, shows a filter icon left of the label with a checkbox value popup. */
  filter?: ColumnValueFilter;
}) {
  const { columnKey, label, activeField, sortOrder, onSort, filter } = props;
  const isActive = activeField === columnKey;
  return (
    <th
      scope="col"
      className="cursor-pointer select-none px-4 py-3 transition-colors hover:text-slate-700"
      onClick={() => onSort(columnKey)}
    >
      <span className="inline-flex items-center gap-1">
        {filter ? <ColumnFilterButton {...filter} /> : null}
        {label}
        {isActive ? (
          sortOrder === 'asc' ? (
            <ArrowUp size={12} className="text-indigo-600" />
          ) : (
            <ArrowDown size={12} className="text-indigo-600" />
          )
        ) : (
          <ArrowUp size={12} className="text-slate-300" />
        )}
      </span>
    </th>
  );
}
