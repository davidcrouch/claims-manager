'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Layers,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/components/shared/detail';
import {
  getCatalogDragData,
  getGroupLabelDragData,
  hasGroupLabelDrag,
  type CatalogDragPayload,
  type GroupLabelDragPayload,
} from '@/components/catalog/catalog-drag';
import type { ApiCombo, ApiGroup, ApiItem } from '@/components/quotes/quote-line-items.types';
import { groupLabel } from '@/components/quotes/quote-line-items.utils';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function lookupDisplay(l?: { name?: string; externalReference?: string }): string {
  if (!l) return '—';
  return l.name ?? l.externalReference ?? '—';
}

/* ---- Sub-components ---- */

function ItemRow({ item, indented }: { item: ApiItem; indented?: boolean }) {
  const mismatches = item.mismatches ?? [];
  return (
    <tr className="transition-colors hover:bg-slate-50">
      <td className="min-w-[10rem] px-4 py-2.5">
        <div className={cn('font-medium text-slate-900', indented && 'pl-7')}>
          {item.name ?? '—'}
          {item.internal && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              internal
            </span>
          )}
        </div>
        {item.description && (
          <p className={cn('mt-0.5 line-clamp-1 text-xs text-slate-500', indented && 'pl-7')}>
            {item.description}
          </p>
        )}
        {mismatches.length > 0 && (
          <span className={cn(
            'mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700',
            indented && 'ml-7',
          )}>
            <AlertTriangle className="h-3 w-3" />
            Catalogue mismatch
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
        {item.type ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-slate-600">
        {[item.category, item.subCategory].filter(Boolean).join(' / ') || '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-700">
        {item.quantity ?? 0}
        {item.unitType && (
          <span className="ml-1 text-xs text-slate-400">
            {lookupDisplay(item.unitType)}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-700">
        {formatCurrency(item.unitCost)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-700">
        {formatCurrency((item.unitCost ?? 0) * (item.quantity ?? 0))}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-700">
        {item.markupType === 'fixed'
          ? formatCurrency(item.markupValue)
          : `${item.markupValue ?? 19}%`}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-700">
        {typeof item.tax === 'number' ? `${+(item.tax * 100).toFixed(2)}%` : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-slate-900">
        {formatCurrency(item.total)}
      </td>
    </tr>
  );
}

function AssemblyBlock({
  combo,
  comboKey,
  comboItems,
  comboItemCount,
  isCollapsed,
  onToggle,
}: {
  combo: ApiCombo;
  comboKey: string;
  comboItems: ApiItem[];
  comboItemCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const comboName = combo.name ?? 'Assembly';
  const comboCategory =
    [combo.category, combo.subCategory].filter(Boolean).join(' / ') || '—';

  return (
    <>
      {/* Assembly header row */}
      <tr
        className="cursor-pointer bg-slate-200 transition-colors hover:bg-slate-300"
        onClick={onToggle}
      >
        <td className="px-4 py-2.5" colSpan={1}>
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
            )}
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-sm font-semibold text-slate-900">{comboName}</span>
            <span className="rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              {comboItemCount} item{comboItemCount !== 1 ? 's' : ''}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-xs text-slate-600">Assembly</td>
        <td className="px-4 py-2.5 text-xs text-slate-600">{comboCategory}</td>
        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-700">
          {combo.quantity ?? '—'}
        </td>
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5" />
        <td className="px-4 py-2.5" />
        <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-slate-900">
          {formatCurrency(combo.total)}
        </td>
      </tr>

      {/* Assembly child items */}
      {!isCollapsed &&
        comboItems.map((item, idx) => (
          <ItemRow
            key={`${comboKey}-item-${item.id ?? idx}`}
            item={item}
            indented
          />
        ))}
    </>
  );
}

export interface QuoteLineItemsTableProps {
  groups: ApiGroup[];
  activeDropKey: string | null;
  setActiveDropKey: (key: string | null) => void;
  onCatalogDrop: (payload: CatalogDragPayload, groupId?: string) => void;
  onGroupLabelDrop?: (payload: GroupLabelDragPayload) => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onMoveGroupUp?: (groupId: string) => void;
  onMoveGroupDown?: (groupId: string) => void;
}

export function QuoteLineItemsTable({
  groups,
  activeDropKey,
  setActiveDropKey,
  onCatalogDrop,
  onGroupLabelDrop,
  onEditGroup,
  onDeleteGroup,
  onMoveGroupUp,
  onMoveGroupDown,
}: QuoteLineItemsTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedCombos, setCollapsedCombos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleCollapse = (groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleCombo = (comboKey: string) => {
    setCollapsedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(comboKey)) next.delete(comboKey);
      else next.add(comboKey);
      return next;
    });
  };

  const totalItems = useMemo(
    () =>
      groups.reduce(
        (sum, g) =>
          sum +
          (g.items?.length ?? 0) +
          (g.combos ?? []).reduce((cs, c) => cs + (c.items?.length ?? 0), 0),
        0,
      ),
    [groups],
  );

  const grandTotals = useMemo(() => {
    let subTotal = 0;
    let markup = 0;
    let totalTax = 0;
    let total = 0;

    function addItemMarkup(item: ApiItem) {
      const cost = (item.unitCost ?? 0) * (item.quantity ?? 0);
      if (item.markupType === 'fixed') {
        markup += (item.markupValue ?? 0) * (item.quantity ?? 0);
      } else {
        const pct = item.markupValue ?? 19;
        markup += cost * (pct / 100);
      }
    }

    for (const g of groups) {
      for (const item of g.items ?? []) {
        subTotal += item.subTotal ?? 0;
        totalTax += item.totalTax ?? 0;
        total += item.total ?? 0;
        addItemMarkup(item);
      }
      for (const combo of g.combos ?? []) {
        subTotal += combo.subTotal ?? 0;
        totalTax += combo.totalTax ?? 0;
        total += combo.total ?? 0;
        for (const item of combo.items ?? []) {
          addItemMarkup(item);
        }
      }
    }
    return { subTotal: subTotal - markup, markup, totalTax, total };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return groups;

    return groups
      .map((group) => {
        const filteredItems = (group.items ?? []).filter(
          (item) =>
            (item.name ?? '').toLowerCase().includes(term) ||
            (item.description ?? '').toLowerCase().includes(term),
        );
        const filteredCombos = (group.combos ?? [])
          .map((combo) => {
            const comboNameMatch = (combo.name ?? '').toLowerCase().includes(term);
            const matchingItems = (combo.items ?? []).filter(
              (item) =>
                (item.name ?? '').toLowerCase().includes(term) ||
                (item.description ?? '').toLowerCase().includes(term),
            );
            if (comboNameMatch || matchingItems.length > 0) {
              return { ...combo, items: comboNameMatch ? combo.items : matchingItems };
            }
            return null;
          })
          .filter(Boolean) as typeof group.combos;
        if (filteredItems.length > 0 || (filteredCombos && filteredCombos.length > 0)) {
          return { ...group, items: filteredItems, combos: filteredCombos };
        }
        return null;
      })
      .filter(Boolean) as ApiGroup[];
  }, [groups, searchTerm]);

  const tableDropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (!hasGroupLabelDrag(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setActiveDropKey('table-root');
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (activeDropKey === 'table-root') setActiveDropKey(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setActiveDropKey(null);
      const labelPayload = getGroupLabelDragData(e.dataTransfer);
      if (labelPayload && onGroupLabelDrop) {
        onGroupLabelDrop(labelPayload);
        return;
      }
    },
  };

  if (groups.length === 0) {
    return (
      <div
        {...tableDropProps}
        className={cn(
          'flex min-h-[12rem] items-center justify-center rounded-lg border-2 border-dashed text-sm text-slate-500 transition-all',
          activeDropKey === 'table-root'
            ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-500/30'
            : 'border-slate-200',
        )}
      >
        {activeDropKey === 'table-root'
          ? 'Release to create a new group'
          : 'No groups yet. Add a group or drag a group label here.'}
      </div>
    );
  }

  return (
    <div className="space-y-3" {...tableDropProps}>
      <div className="sticky top-[105px] z-[9] flex items-center justify-between rounded-lg border-2 border-slate-400 bg-slate-100 px-5 py-4 shadow-md">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-600" />
          <p className="text-sm font-semibold text-slate-800">
            {groups.length} group{groups.length !== 1 ? 's' : ''} &middot; {totalItems} line
            {totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-96">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search line items…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 border-slate-400 bg-white pl-8 pr-8 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 border border-slate-300 px-2 text-xs text-slate-600 hover:text-slate-900"
            onClick={() => {
              setCollapsed(new Set());
              setCollapsedCombos(new Set());
            }}
            title="Expand all"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 border border-slate-300 px-2 text-xs text-slate-600 hover:text-slate-900"
            onClick={() => {
              const allGroupIds = groups.map((g, i) => g.id ?? `group-${i}`);
              setCollapsed(new Set(allGroupIds));
              const allComboKeys = groups.flatMap((g, gi) =>
                (g.combos ?? []).map((c, ci) => `${g.id ?? `group-${gi}`}-combo-${c.id ?? ci}`),
              );
              setCollapsedCombos(new Set(allComboKeys));
            }}
            title="Collapse all"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-slate-600">
            Subtotal{' '}
            <span className="text-base font-semibold tabular-nums text-slate-900">
              {formatCurrency(grandTotals.subTotal)}
            </span>
          </div>
          <div className="text-sm text-slate-600">
            Markup{' '}
            <span className="text-base font-semibold tabular-nums text-slate-900">
              {formatCurrency(grandTotals.markup)}
            </span>
          </div>
          <div className="text-sm text-slate-600">
            GST{' '}
            <span className="text-base font-semibold tabular-nums text-slate-900">
              {formatCurrency(grandTotals.totalTax)}
            </span>
          </div>
          <div className="text-sm text-slate-600">
            Total{' '}
            <span className="text-xl font-bold tabular-nums text-slate-950">
              {formatCurrency(grandTotals.total)}
            </span>
          </div>
        </div>
      </div>

      {activeDropKey === 'table-root' && (
        <div className="rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50/40 px-4 py-2.5 text-center text-xs font-medium text-emerald-700">
          Release to create a new group
        </div>
      )}

      {searchTerm && filteredGroups.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-sm text-slate-400">
          No line items match &ldquo;{searchTerm}&rdquo;
        </div>
      )}

      {filteredGroups.map((group, groupIndex) => {
        const gId = group.id ?? `group-${groupIndex}`;
        const label = groupLabel(group, groupIndex);
        const isCollapsed = searchTerm ? false : collapsed.has(gId);
        const dropKey = `group-drop-${gId}`;
        const isDropActive = activeDropKey === dropKey;

        const standaloneItems = group.items ?? [];
        const combos = group.combos ?? [];
        const standaloneTotal = standaloneItems.reduce((sum, it) => sum + (it.total ?? 0), 0);
        const comboTotal = combos.reduce((sum, c) => sum + (c.total ?? 0), 0);
        const groupTotal = standaloneTotal + comboTotal;
        const totalLineCount =
          standaloneItems.length +
          combos.reduce((cs, c) => cs + (c.items?.length ?? 0), 0);

        const dropProps = {
          onDragOver: (e: React.DragEvent) => {
            if (hasGroupLabelDrag(e.dataTransfer)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            setActiveDropKey(dropKey);
          },
          onDragLeave: (e: React.DragEvent) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            if (activeDropKey === dropKey) setActiveDropKey(null);
          },
          onDrop: (e: React.DragEvent) => {
            if (hasGroupLabelDrag(e.dataTransfer)) return;
            e.preventDefault();
            setActiveDropKey(null);
            const payload = getCatalogDragData(e.dataTransfer);
            if (!payload) return;
            onCatalogDrop(payload, group.id);
          },
        };

        return (
          <div
            key={gId}
            {...dropProps}
            className={cn(
              'overflow-hidden rounded-lg border shadow-sm transition-all',
              isDropActive
                ? 'border-amber-400 ring-2 ring-amber-500/30'
                : 'border-slate-200',
            )}
          >
            {/* Group header */}
            <div
              className="flex cursor-pointer items-center gap-2 bg-blue-100 px-4 py-3 transition-colors hover:bg-blue-200"
              onClick={() => toggleCollapse(gId)}
            >
              <span className="flex items-center text-blue-600">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>

              <GripVertical className="h-4 w-4 text-blue-400" />

              <div className="flex-1">
                <span className="text-sm font-semibold text-blue-950">{label}</span>
                {group.description && label !== group.description && (
                  <span className="ml-2 text-xs text-blue-700">{group.description}</span>
                )}
              </div>

              <span className="text-xs tabular-nums text-blue-700">
                {totalLineCount} item{totalLineCount !== 1 ? 's' : ''}
                {combos.length > 0 && ` · ${combos.length} assembl${combos.length !== 1 ? 'ies' : 'y'}`}
              </span>
              <span className="text-sm font-medium tabular-nums text-blue-900">
                {formatCurrency(groupTotal)}
              </span>

              {(onEditGroup || onDeleteGroup || onMoveGroupUp || onMoveGroupDown) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEditGroup && (
                      <DropdownMenuItem onClick={() => onEditGroup(gId)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit group
                      </DropdownMenuItem>
                    )}
                    {onMoveGroupUp && groupIndex > 0 && (
                      <DropdownMenuItem onClick={() => onMoveGroupUp(gId)}>
                        <ArrowUp className="mr-2 h-3.5 w-3.5" />
                        Move up
                      </DropdownMenuItem>
                    )}
                    {onMoveGroupDown && groupIndex < groups.length - 1 && (
                      <DropdownMenuItem onClick={() => onMoveGroupDown(gId)}>
                        <ArrowDown className="mr-2 h-3.5 w-3.5" />
                        Move down
                      </DropdownMenuItem>
                    )}
                    {onDeleteGroup && (
                      <DropdownMenuItem
                        onClick={() => onDeleteGroup(gId)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete group
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Drop indicator */}
            {isDropActive && (
              <div className="bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700">
                Release to add catalogue item to &ldquo;{label}&rdquo;
              </div>
            )}

            {/* Group body - items table */}
            {!isCollapsed && (
              <div className="bg-white">
                {totalLineCount > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50/50">
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          <th scope="col" className="px-4 py-2">Name</th>
                          <th scope="col" className="px-4 py-2">Type</th>
                          <th scope="col" className="px-4 py-2">Category</th>
                          <th scope="col" className="px-4 py-2 text-right">Qty</th>
                          <th scope="col" className="px-4 py-2 text-right">Unit</th>
                          <th scope="col" className="px-4 py-2 text-right">Extended</th>
                          <th scope="col" className="px-4 py-2 text-right">Markup</th>
                          <th scope="col" className="px-4 py-2 text-right">GST</th>
                          <th scope="col" className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {/* Standalone items (not part of an assembly) */}
                        {standaloneItems.map((item, idx) => (
                          <ItemRow key={item.id ?? `standalone-${idx}`} item={item} />
                        ))}

                        {/* Assembly (combo) groups */}
                        {combos.map((combo, comboIdx) => {
                          const comboKey = `${gId}-combo-${combo.id ?? comboIdx}`;
                          const isComboCollapsed = searchTerm ? false : collapsedCombos.has(comboKey);
                          const comboItems = combo.items ?? [];
                          const comboItemCount = comboItems.length;

                          return (
                            <AssemblyBlock
                              key={comboKey}
                              combo={combo}
                              comboKey={comboKey}
                              comboItems={comboItems}
                              comboItemCount={comboItemCount}
                              isCollapsed={isComboCollapsed}
                              onToggle={() => toggleCombo(comboKey)}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                    Drag catalogue items here to add lines
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
