'use client';

import { memo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Package,
  Save,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/detail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLineItems } from './LineItemsProvider';
import { groupLabel as getGroupLabel } from './lib/money';

interface LineItemsToolbarProps {
  hideActions?: boolean;
}

export const LineItemsToolbar = memo(function LineItemsToolbar({ hideActions = false }: LineItemsToolbarProps) {
  const {
    groups,
    pagedGroups,
    totalUnits,
    grandTotals,
    config,
    isDirty,
    dirtyEdits,
    searchTerm,
    hiddenGroupIds,
    collapsed,
    selection,
    showUnselected,
    actions,
    setSearchTerm,
    setHiddenGroupIds,
    setShowMarkup,
    setShowGst,
    setShowQuantities,
    setShowPricing,
    setShowUnselected,
    toggleAll,
  } = useLineItems();

  const { showPricing, showMarkup, showGst, showQuantities, mode, showColumnVisibilityToggles, labels } = config;
  const showSelect = !!selection;
  const allCollapsed = groups.length > 0 && groups.every((g, i) => collapsed.has(g.id ?? `group-${i}`));
  const groupFilterActive = hiddenGroupIds.size > 0;
  const [groupFilterOpen, setGroupFilterOpen] = useState(false);
  const [suppressMarkupIcon, setSuppressMarkupIcon] = useState(false);
  const [suppressGstIcon, setSuppressGstIcon] = useState(false);

  return (
    <div
      data-slot="line-items-toolbar"
      className={cn(
        'sticky z-[9] flex cursor-pointer items-center justify-between rounded-lg border-2 border-slate-400 bg-slate-100 px-5 py-4 shadow-md transition-colors hover:bg-slate-200',
        'top-0',
      )}
      onClick={toggleAll}
    >
      {/* Left: collapse toggle + line count */}
      <div className="flex items-center gap-2">
        <span className="flex items-center text-slate-600">
          {allCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        <Layers className="h-4 w-4 text-slate-600" />

        <span onClick={(e) => e.stopPropagation()}>
          <DropdownMenu open={groupFilterOpen} onOpenChange={setGroupFilterOpen}>
            <DropdownMenuTrigger>
              <span className="group/gf inline-flex cursor-default items-center gap-1" title={groupFilterActive ? 'Group filter active' : 'Filter groups'}>
                <span className="text-sm font-semibold text-slate-800">
                  {totalUnits} {totalUnits !== 1 ? labels.linePlural : labels.lineSingular}
                </span>
                {groupFilterActive ? (
                  <Filter className="h-4 w-4 text-amber-500" />
                ) : (
                  <Filter className="h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover/gf:opacity-100" />
                )}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[240px]">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Filter groups</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    onClick={() => setHiddenGroupIds(new Set())}
                  >All</button>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    onClick={() => setHiddenGroupIds(new Set(groups.map((g, i) => g.id ?? `group-${i}`)))}
                  >None</button>
                </div>
              </div>
              <DropdownMenuSeparator />
              {groups.map((g, i) => {
                const id = g.id ?? `group-${i}`;
                const isVisible = !hiddenGroupIds.has(id);
                return (
                  <DropdownMenuItem
                    key={id}
                    closeOnClick={false}
                    onClick={(e) => {
                      e.preventDefault();
                      const next = new Set(hiddenGroupIds);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      setHiddenGroupIds(next);
                    }}
                    className="justify-between"
                  >
                    <span className={cn('text-sm', !isVisible && 'text-slate-400')}>{getGroupLabel(g, i)}</span>
                    <span className={cn('h-4 w-4 rounded border', isVisible ? 'border-blue-500 bg-blue-500' : 'border-slate-300')} />
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {/* Center: search + toggles + buttons */}
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {mode !== 'catalog' && (
          <div className="relative w-56">
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
        )}

        {mode !== 'catalog' && (showColumnVisibilityToggles || showSelect) && (
          <div className="flex items-center gap-3 border-l border-slate-300 pl-3">
            {showColumnVisibilityToggles && (
              <>
                <div className="flex items-center gap-1.5">
                  <Switch id="li-show-qty" checked={showQuantities} onCheckedChange={setShowQuantities} aria-label="Show quantities" />
                  <Label htmlFor="li-show-qty" className="cursor-pointer text-xs font-medium text-slate-700">Qty</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch id="li-show-pricing" checked={showPricing} onCheckedChange={setShowPricing} aria-label="Show pricing" />
                  <Label htmlFor="li-show-pricing" className="cursor-pointer text-xs font-medium text-slate-700">Pricing</Label>
                </div>
              </>
            )}
            {showSelect && (
              <div className="flex items-center gap-1.5">
                <Switch id="li-show-unselected" checked={showUnselected} onCheckedChange={setShowUnselected} aria-label="Show unselected" />
                <Label htmlFor="li-show-unselected" className="cursor-pointer text-xs font-medium text-slate-700">Unselected</Label>
              </div>
            )}
          </div>
        )}

        {!hideActions && (
          <div className="flex items-center gap-1">
            {actions.onOpenCatalogDrawer && (
              <Button size="sm" variant="outline" onClick={actions.onOpenCatalogDrawer} title="Open catalogue">
                <Package className="h-4 w-4" />
              </Button>
            )}
            {actions.onSave && mode !== 'catalog' && (
              <Button
                size="sm"
                variant="outline"
                disabled={!isDirty}
                onClick={() => actions.onSave?.(dirtyEdits)}
                title="Save changes"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right: totals with toggle UX */}
      <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {showPricing && (
          <>
            <div className="text-sm text-slate-600">
              Subtotal{' '}
              <span className="text-base font-semibold tabular-nums text-slate-900">
                {formatCurrency(grandTotals.subTotal)}
              </span>
            </div>

            <MarkupToggle
              label="Markup"
              value={grandTotals.markup}
              isVisible={showMarkup}
              suppressIcon={suppressMarkupIcon}
              setSuppressIcon={setSuppressMarkupIcon}
              onToggle={() => { setShowMarkup(!showMarkup); setSuppressMarkupIcon(true); }}
            />

            <MarkupToggle
              label="GST"
              value={grandTotals.totalTax}
              isVisible={showGst}
              suppressIcon={suppressGstIcon}
              setSuppressIcon={setSuppressGstIcon}
              onToggle={() => { setShowGst(!showGst); setSuppressGstIcon(true); }}
            />

            <div className="text-sm text-slate-600">
              Total{' '}
              <span className="text-xl font-bold tabular-nums text-slate-950">
                {formatCurrency(grandTotals.total)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

function MarkupToggle({
  label,
  value,
  isVisible,
  suppressIcon,
  setSuppressIcon,
  onToggle,
}: {
  label: string;
  value: number;
  isVisible: boolean;
  suppressIcon: boolean;
  setSuppressIcon: (v: boolean) => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="group/tog flex cursor-default select-none items-center gap-1 text-sm text-slate-600 transition-opacity hover:opacity-70"
      onClick={onToggle}
      onMouseLeave={() => setSuppressIcon(false)}
      title={isVisible ? `Hide ${label} column` : `Show ${label} column`}
    >
      <span className="relative inline-flex items-center">
        {isVisible ? (
          <EyeOff className={cn('h-3.5 w-3.5 text-red-500 transition-opacity', suppressIcon ? 'opacity-0' : 'opacity-0 group-hover/tog:opacity-100')} />
        ) : (
          <>
            <EyeOff className={cn('h-3.5 w-3.5 text-red-400 transition-opacity', suppressIcon ? 'opacity-100' : 'group-hover/tog:opacity-0')} />
            <Eye className={cn('absolute inset-0 h-3.5 w-3.5 text-green-500 transition-opacity', suppressIcon ? 'opacity-0' : 'opacity-0 group-hover/tog:opacity-100')} />
          </>
        )}
      </span>
      {label}{' '}
      <span className={cn('text-base font-semibold tabular-nums text-slate-900', !isVisible && 'opacity-40')}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
