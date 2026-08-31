'use client';

import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Layers, MoreVertical, StickyNote, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/detail';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLineItems } from './LineItemsProvider';
import { DropIndicatorLine, useDropIndicatorBorder } from './DropIndicatorLine';
import { useDropTargetHighlight } from './lib/drop-highlight';
import { useCatalogDrop } from './hooks/use-catalog-drop';
import { computeItemMoney, initScopeInputs } from './lib/money';
import { LineScopeStatusBadge } from './lib/badges';
import { displayLabelText } from './lib/display';
import { RowLeadCheckbox, RowLeadDrag, RowLeadExpand, ROW_LEAD_ROW_CLS } from './lib/row-lead';
import { LI_HEADER_COUNT, LI_HEADER_TOTAL, LineItemsColGroup, LineItemsThead, LineItemsTableShell } from './lib/table-parts';
import { HeaderVisibilityToggles } from './lib/header-visibility';
import { LineDetailHoverWrap } from './lib/line-detail-hover';
import { filterVisibleCombos, filterVisibleItems, isSelectablePicked } from './lib/selection-filter';
import type { ApiItem, ApiScope } from './lib/types';
import { ItemRow } from './ItemRow';
import { AssemblyRow } from './AssemblyRow';

interface ScopeCardProps {
  scope: ApiScope;
  scopeKey: string;
  groupId: string;
  isCollapsed: boolean;
  onToggle: () => void;
  parentShowQuantities?: boolean;
  parentShowPricing?: boolean;
}

export const ScopeCard = memo(function ScopeCard({
  scope,
  scopeKey,
  groupId,
  isCollapsed,
  onToggle,
  parentShowQuantities,
  parentShowPricing,
}: ScopeCardProps) {
  const {
    config,
    isReadOnly,
    editState,
    editInputs,
    dirtyRowKeys,
    selection,
    bulkSelectedIds,
    collapsedCombos,
    actions,
    setEditState,
    setEditInputs,
    handleInputChange,
    handleCellKeyDown,
    handleBulkToggle,
    toggleCombo,
    hideUnselected,
    resolveHeaderVisibility,
    isHeaderOverridden,
    toggleHeaderOverride,
    toggleHeaderField,
  } = useLineItems();

  const {
    showMarkup,
    showGst,
    enableLineNotes,
    showCategory,
    showQuantities: globalQuantities,
    showPricing: globalPricing,
    showColumnVisibilityToggles,
    hideComponent,
  } = config;
  const parentQty = parentShowQuantities ?? globalQuantities;
  const parentPrice = parentShowPricing ?? globalPricing;
  const resolvedScope = resolveHeaderVisibility(scopeKey, parentQty, parentPrice);
  const showQuantities = showColumnVisibilityToggles ? resolvedScope.showQuantities : parentQty;
  const showPricing = showColumnVisibilityToggles ? resolvedScope.showPricing : parentPrice;
  const showSelect = !!selection;
  const showBulkSelect = !isReadOnly && !showSelect;
  const showDragHandle = !isReadOnly && !!actions.onReorderLineItems;

  const scopeItems = scope.items ?? [];
  const scopeCombos = scope.combos ?? [];
  const visibleScopeItems = filterVisibleItems(scopeItems, hideUnselected, selection?.selectedIds);
  const visibleScopeCombos = filterVisibleCombos(scopeCombos, hideUnselected, selection?.selectedIds);
  const isEditing = editState?.rowKey === scopeKey;
  const scopeInputs = editInputs[scopeKey] ?? null;
  const isDirty = dirtyRowKeys.has(scopeKey);
  const scopeName = scopeInputs?.name || scope.name || 'Scope';
  const scopeComponent = displayLabelText(scopeInputs?.component ?? scope.component);
  const scopeDescription = displayLabelText(scopeInputs?.description ?? scope.description);

  const totalChildLines =
    visibleScopeItems.length +
    visibleScopeCombos.reduce((sum, c) => sum + filterVisibleItems(c.items ?? [], hideUnselected, selection?.selectedIds).length, 0);

  const scopePickIds = [
    ...(scope.id ? [scope.id] : []),
    ...scopeItems.map((i) => i.id!).filter(Boolean),
    ...scopeCombos.flatMap((c) => [
      ...(c.id ? [c.id] : []),
      ...(c.items ?? []).map((i) => i.id!).filter(Boolean),
    ]),
  ];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scopeKey, disabled: !showDragHandle });

  const indicatorBorder = useDropIndicatorBorder(scopeKey);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    ...indicatorBorder,
  };

  const { isOver: isCatalogOver, dropHandlers: scopeDropHandlers } = useCatalogDrop({
    target: 'scope',
    groupId,
    quoteComboId: scope.id,
    onCatalogDrop: (payload, gId, comboId) => {
      if (isCollapsed) onToggle();
      actions.onCatalogDrop?.(payload, gId, comboId);
    },
    disabled: isReadOnly || !actions.onCatalogDrop,
  });

  const scopeTotal = useMemo(() => {
    let sum = 0;
    function addItem(item: ApiItem, itemKey: string) {
      if (hideUnselected && !isSelectablePicked(item.id, selection?.selectedIds)) return;
      sum += computeItemMoney(item, editInputs[itemKey], showMarkup, showGst).total;
    }
    for (let idx = 0; idx < scopeItems.length; idx++) {
      addItem(scopeItems[idx], `${scopeKey}-item-${scopeItems[idx].id ?? idx}`);
    }
    for (let ci = 0; ci < scopeCombos.length; ci++) {
      const combo = scopeCombos[ci];
      const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
      for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
        const item = combo.items![ii];
        addItem(item, `${comboKey}-item-${item.id ?? ii}`);
      }
    }
    return sum;
  }, [scopeItems, scopeCombos, scopeKey, showMarkup, showGst, editInputs, hideUnselected, selection?.selectedIds]);

  const showScopeNotesColumn = enableLineNotes && !showPricing;

  const scopeDropHighlight = useDropTargetHighlight(scopeKey, 'scope');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative my-1.5 overflow-hidden rounded-lg border transition-colors',
        isCatalogOver
          ? 'border-violet-400 ring-2 ring-violet-300 bg-violet-50/50'
          : scopeDropHighlight
            ? cn(scopeDropHighlight, 'border-violet-200')
            : isEditing
              ? 'border-violet-400 ring-2 ring-violet-200'
              : isDirty
                ? 'border-emerald-300'
                : 'border-violet-200',
      )}
      {...scopeDropHandlers}
    >
      <DropIndicatorLine rowKey={scopeKey} variant="card" />
      {/* Scope header */}
      <LineDetailHoverWrap
        title={scopeName}
        component={scopeInputs?.component ?? scope.component}
        description={scopeInputs?.description ?? scope.description}
        note={scope.note}
        hideComponent={hideComponent}
        className={cn(
          ROW_LEAD_ROW_CLS,
          'cursor-pointer py-2.5 pr-3 transition-colors',
          isEditing
            ? 'ring-2 ring-inset ring-violet-300 bg-violet-50/60'
            : isDirty ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-violet-50 hover:bg-violet-100',
        )}
        data-composite-row
        onClick={(e) => {
          if (showSelect) {
            selection?.onChange(toggleIds(selection.selectedIds, scopePickIds));
            return;
          }
          if (isReadOnly) { onToggle(); return; }
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT') return;
          if (isEditing) { onToggle(); return; }
          setEditInputs((prev) => {
            if (prev[scopeKey]) return prev;
            return { ...prev, [scopeKey]: initScopeInputs(scope) };
          });
          setEditState({ rowKey: scopeKey, field: 'name' });
        }}
      >
        <RowLeadDrag
          show={showDragHandle}
          attributes={attributes}
          listeners={listeners}
          iconClassName="text-violet-300 hover:text-violet-500"
        />

        <RowLeadCheckbox
          show={showBulkSelect || showSelect}
          checked={showBulkSelect
            ? scopePickIds.every((id) => bulkSelectedIds.has(id))
            : selection ? scopePickIds.every((id) => selection.selectedIds.has(id)) : false}
          indeterminate={showBulkSelect
            ? scopePickIds.some((id) => bulkSelectedIds.has(id)) &&
              !scopePickIds.every((id) => bulkSelectedIds.has(id))
            : selection
              ? scopePickIds.some((id) => selection.selectedIds.has(id)) &&
                !scopePickIds.every((id) => selection.selectedIds.has(id))
              : false}
          onCheckedChange={() => {
            if (showBulkSelect) handleBulkToggle(scopePickIds);
            else selection?.onChange(toggleIds(selection.selectedIds, scopePickIds));
          }}
          aria-label={`Select scope ${scopeName}`}
        />

        <RowLeadExpand show isCollapsed={isCollapsed} iconClassName="text-violet-600" />

        <Layers className="h-4 w-4 shrink-0 text-violet-500" />

        {isEditing && scopeInputs ? (
          <div className="flex min-w-0 flex-1 flex-col pl-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-violet-900 outline-none placeholder:text-violet-300"
                value={scopeInputs.name}
                onChange={(e) => handleInputChange(scopeKey, 'name', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey: scopeKey, field: 'name' })}
                placeholder="Name…"
              />
              {!hideComponent && (
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-violet-600 outline-none placeholder:text-violet-300"
                value={scopeInputs.component}
                onChange={(e) => handleInputChange(scopeKey, 'component', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey: scopeKey, field: 'component' })}
                placeholder="Component…"
              />
              )}
            </div>
            <input
              className="w-full bg-transparent text-xs text-violet-500 outline-none placeholder:text-violet-300"
              value={scopeInputs.description}
              onChange={(e) => handleInputChange(scopeKey, 'description', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey: scopeKey, field: 'description' })}
              placeholder="Description…"
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
            <span className="truncate text-sm font-semibold text-violet-900">
              {scopeName}
              {!hideComponent && scopeComponent && <span className="font-normal text-violet-600"> — {scopeComponent}</span>}
            </span>
            {scopeDescription && (
              <span className="hidden truncate text-xs text-violet-400 sm:inline">{scopeDescription}</span>
            )}
            <LineScopeStatusBadge status={scope.lineScopeStatus} />
          </div>
        )}

        {showQuantities && (
          <span className="flex shrink-0 items-baseline justify-end gap-1 pl-3 text-violet-600" title="Scope quantity">
            <span className="text-[10px] font-medium uppercase tracking-wide text-violet-500">Qty</span>
            {isEditing && scopeInputs ? (
              <input
                className="w-12 bg-transparent text-right font-mono text-sm outline-none"
                value={scopeInputs.quantity}
                onChange={(e) => handleInputChange(scopeKey, 'quantity', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey: scopeKey, field: 'quantity' })}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="min-w-[1.5rem] text-right font-mono text-sm">
                {scopeInputs?.quantity ?? scope.quantity ?? ''}
              </span>
            )}
          </span>
        )}

        <span className={cn(LI_HEADER_COUNT, 'text-violet-600')}>
          {totalChildLines} item{totalChildLines !== 1 ? 's' : ''}
          {scopeCombos.length > 0 && ` · ${visibleScopeCombos.length} assembl${visibleScopeCombos.length !== 1 ? 'ies' : 'y'}`}
        </span>

        {showPricing && (
          <span className={cn(LI_HEADER_TOTAL, 'text-violet-900')}>
            {formatCurrency(scopeTotal)}
          </span>
        )}

        {enableLineNotes && scope.id && actions.onEditLineNote && (
          <span onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-7 w-7 p-0', scope.note && 'text-amber-600 hover:text-amber-700')}
              title={scope.note ? `Edit notes for ${scopeName}` : `Add notes for ${scopeName}`}
              onClick={() => actions.onEditLineNote!({ targetType: 'combo', targetId: scope.id!, label: scopeName, note: scope.note })}
            >
              <StickyNote className={cn('h-3.5 w-3.5', scope.note && 'fill-amber-100')} />
            </Button>
          </span>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          {!isReadOnly && actions.onDeleteScope && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-violet-200/80">
                <MoreVertical className="h-4 w-4 text-violet-700" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => scope.id && actions.onDeleteScope?.(scope.id)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete scope
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </LineDetailHoverWrap>

      {/* Scope content */}
      {!isCollapsed && (visibleScopeItems.length > 0 || visibleScopeCombos.length > 0) && (
        <div className="mx-3 border-t border-violet-100">
          {/* Scope-level items */}
          {visibleScopeItems.length > 0 && (
            <div className="overflow-x-auto">
              <LineItemsTableShell
                showOverrides={showColumnVisibilityToggles}
                overrides={
                  <HeaderVisibilityToggles
                    isOverridden={isHeaderOverridden(scopeKey)}
                    onToggleOverride={() => toggleHeaderOverride(scopeKey, parentQty, parentPrice)}
                    showQuantities={resolvedScope.showQuantities}
                    showPricing={resolvedScope.showPricing}
                    onToggleQuantities={() => toggleHeaderField(scopeKey, 'showQuantities', resolvedScope.showQuantities)}
                    onTogglePricing={() => toggleHeaderField(scopeKey, 'showPricing', resolvedScope.showPricing)}
                    colorScheme="violet"
                  />
                }
              >
              <table className="w-full table-fixed divide-y divide-slate-50 text-sm">
                <LineItemsColGroup
                  showDragHandle={showDragHandle}
                  showBulkSelect={showBulkSelect}
                  showSelect={showSelect}
                  showCategory={showCategory}
                  showQuantities={showQuantities}
                  showPricing={showPricing}
                  showMarkup={showMarkup}
                  showGst={showGst}
                  showNotesColumn={showScopeNotesColumn}
                />
                <LineItemsThead
                  showDragHandle={showDragHandle}
                  showBulkSelect={showBulkSelect}
                  showSelect={showSelect}
                  showCategory={showCategory}
                  showQuantities={showQuantities}
                  showPricing={showPricing}
                  showMarkup={showMarkup}
                  showGst={showGst}
                  showNotesColumn={showScopeNotesColumn}
                />
                <tbody className="divide-y divide-slate-50">
                  {visibleScopeItems.map((item, idx) => (
                    <ItemRow
                      key={`${scopeKey}-item-${item.id ?? idx}`}
                      item={item}
                      rowKey={`${scopeKey}-item-${item.id ?? idx}`}
                      indented
                      parentShowQuantities={showQuantities}
                      parentShowPricing={showPricing}
                    />
                  ))}
                </tbody>
              </table>
              </LineItemsTableShell>
            </div>
          )}

          {/* Scope-nested assemblies as sub-cards */}
          {visibleScopeCombos.map((combo, ci) => {
            const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
            return (
              <AssemblyRow
                key={comboKey}
                combo={combo}
                comboKey={comboKey}
                groupId={groupId}
                isCollapsed={collapsedCombos.has(comboKey)}
                onToggle={() => toggleCombo(comboKey)}
                parentShowQuantities={showQuantities}
                parentShowPricing={showPricing}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

function toggleIds(set: Set<string>, ids: string[]): Set<string> {
  const next = new Set(set);
  const allIn = ids.every((id) => next.has(id));
  if (allIn) ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}
