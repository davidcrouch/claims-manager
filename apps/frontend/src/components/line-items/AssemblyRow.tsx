'use client';

import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Boxes, MoreVertical, StickyNote, Trash2 } from 'lucide-react';
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
import { computeItemMoney, initComboInputs } from './lib/money';
import { LineScopeStatusBadge, PublishStatusBadge } from './lib/badges';
import { displayLabelText } from './lib/display';
import { RowLeadCheckbox, RowLeadDrag, RowLeadExpand, ROW_LEAD_ROW_CLS } from './lib/row-lead';
import { LineItemsColGroup, LineItemsThead, LineItemsTableShell } from './lib/table-parts';
import { HeaderVisibilityToggles } from './lib/header-visibility';
import { NoteHoverWrap } from './lib/line-note-hover';
import { filterVisibleItems, isSelectablePicked } from './lib/selection-filter';
import type { ApiCombo } from './lib/types';
import { ItemRow } from './ItemRow';

interface AssemblyRowProps {
  combo: ApiCombo;
  comboKey: string;
  groupId: string;
  isCollapsed: boolean;
  onToggle: () => void;
  parentShowQuantities?: boolean;
  parentShowPricing?: boolean;
}

export const AssemblyRow = memo(function AssemblyRow({
  combo,
  comboKey,
  groupId,
  isCollapsed,
  onToggle,
  parentShowQuantities,
  parentShowPricing,
}: AssemblyRowProps) {
  const {
    config,
    isReadOnly,
    editState,
    editInputs,
    dirtyRowKeys,
    selectedRows,
    selection,
    bulkSelectedIds,
    actions,
    setEditState,
    setEditInputs,
    handleInputChange,
    handleCellKeyDown,
    handleBulkToggle,
    hideUnselected,
    resolveHeaderVisibility,
    isHeaderOverridden,
    toggleHeaderOverride,
    toggleHeaderField,
  } = useLineItems();

  const { showMarkup, showGst, enableLineNotes, showQuantities: globalQuantities, showPricing: globalPricing, showCategory, showColumnVisibilityToggles } = config;
  const parentQty = parentShowQuantities ?? globalQuantities;
  const parentPrice = parentShowPricing ?? globalPricing;
  const resolvedAssembly = resolveHeaderVisibility(comboKey, parentQty, parentPrice);
  const showQuantities = showColumnVisibilityToggles ? resolvedAssembly.showQuantities : parentQty;
  const showPricing = showColumnVisibilityToggles ? resolvedAssembly.showPricing : parentPrice;
  const assemblyContentDisabled = {
    quantities: parentQty && !showQuantities,
    pricing: parentPrice && !showPricing,
  };
  const showSelect = !!selection;
  const showBulkSelect = !isReadOnly && !showSelect;
  const showDragHandle = !isReadOnly && !!actions.onReorderLineItems;

  const comboItems = combo.items ?? [];
  const visibleComboItems = filterVisibleItems(comboItems, hideUnselected, selection?.selectedIds);
  const isEditing = editState?.rowKey === comboKey;
  const comboInputs = editInputs[comboKey] ?? null;
  const isDirty = dirtyRowKeys.has(comboKey);
  const comboName = combo.name ?? 'Assembly';
  const comboComponent = displayLabelText(combo.component);

  const comboPickIds = [
    ...(combo.id ? [combo.id] : []),
    ...comboItems.map((i) => i.id!).filter(Boolean),
  ];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: comboKey, disabled: !showDragHandle });

  const indicatorBorder = useDropIndicatorBorder(comboKey);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    ...indicatorBorder,
  };

  const { isOver: isCatalogOver, dropHandlers: assemblyDropHandlers } = useCatalogDrop({
    target: 'assembly',
    groupId,
    quoteComboId: combo.id,
    onCatalogDrop: (payload, gId, comboId) => {
      if (isCollapsed) onToggle();
      actions.onCatalogDrop?.(payload, gId, comboId);
    },
    disabled: isReadOnly || !actions.onCatalogDrop,
  });

  const comboTotal = useMemo(() => {
    let sum = 0;
    for (let idx = 0; idx < comboItems.length; idx++) {
      const item = comboItems[idx];
      if (hideUnselected && !isSelectablePicked(item.id, selection?.selectedIds)) continue;
      const itemKey = `${comboKey}-item-${item.id ?? idx}`;
      sum += computeItemMoney(item, editInputs[itemKey], showMarkup, showGst).total;
    }
    return sum;
  }, [comboItems, comboKey, showMarkup, showGst, editInputs, hideUnselected, selection?.selectedIds]);

  const showAssemblyNotesColumn = enableLineNotes && !showPricing;

  const assemblyDropHighlight = useDropTargetHighlight(comboKey, 'assembly');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative my-1 overflow-hidden rounded-md border transition-colors',
        isCatalogOver
          ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50/30'
          : assemblyDropHighlight
            ? cn(assemblyDropHighlight, 'border-slate-200')
            : isEditing
              ? 'border-amber-300 ring-2 ring-amber-200'
              : isDirty
                ? 'border-emerald-300'
                : 'border-slate-200',
      )}
      {...assemblyDropHandlers}
    >
      <DropIndicatorLine rowKey={comboKey} variant="card" />
      {/* Assembly header */}
      <NoteHoverWrap
        note={combo.note}
        enabled={enableLineNotes}
        className={cn(
          ROW_LEAD_ROW_CLS,
          'cursor-pointer py-2 pr-3 transition-colors',
          isEditing
            ? 'ring-2 ring-inset ring-amber-300 bg-amber-50/40'
            : isDirty ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-slate-100 hover:bg-slate-200',
        )}
        data-composite-row
        onClick={(e) => {
          if (showSelect) {
            selection?.onChange(toggleIds(selection.selectedIds, comboPickIds));
            return;
          }
          if (isReadOnly) { onToggle(); return; }
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT') return;
          if (isEditing) { onToggle(); return; }
          setEditInputs((prev) => {
            if (prev[comboKey]) return prev;
            return { ...prev, [comboKey]: initComboInputs(combo) };
          });
          setEditState({ rowKey: comboKey, field: 'name' });
        }}
      >
        <RowLeadDrag
          show={showDragHandle}
          attributes={attributes}
          listeners={listeners}
          iconClassName="text-slate-400 hover:text-slate-600"
        />

        <RowLeadCheckbox
          show={showBulkSelect || showSelect}
          checked={showBulkSelect
            ? comboPickIds.every((id) => bulkSelectedIds.has(id))
            : selection ? comboPickIds.every((id) => selection.selectedIds.has(id)) : false}
          indeterminate={showBulkSelect
            ? comboPickIds.some((id) => bulkSelectedIds.has(id)) &&
              !comboPickIds.every((id) => bulkSelectedIds.has(id))
            : selection
              ? comboPickIds.some((id) => selection.selectedIds.has(id)) &&
                !comboPickIds.every((id) => selection.selectedIds.has(id))
              : false}
          onCheckedChange={() => {
            if (showBulkSelect) handleBulkToggle(comboPickIds);
            else selection?.onChange(toggleIds(selection.selectedIds, comboPickIds));
          }}
          aria-label={`Select assembly ${comboName}`}
        />

        <RowLeadExpand show isCollapsed={isCollapsed} iconClassName="text-slate-500" />

        <Boxes className="h-4 w-4 shrink-0 text-slate-500" />

        {isEditing && comboInputs ? (
          <div className="flex min-w-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
                value={comboInputs.name}
                onChange={(e) => handleInputChange(comboKey, 'name', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey: comboKey, field: 'name' })}
                placeholder="Name…"
              />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-300"
                value={comboInputs.component}
                onChange={(e) => handleInputChange(comboKey, 'component', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey: comboKey, field: 'component' })}
                placeholder="Component…"
              />
            </div>
            <input
              className="w-full bg-transparent text-xs text-slate-500 outline-none placeholder:text-slate-300"
              value={comboInputs.description}
              onChange={(e) => handleInputChange(comboKey, 'description', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey: comboKey, field: 'description' })}
              placeholder="Description…"
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-700">
              {comboName}
              {comboComponent && <span className="font-normal text-slate-500"> — {comboComponent}</span>}
            </span>
            <span className="shrink-0 rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              {visibleComboItems.length} item{visibleComboItems.length !== 1 ? 's' : ''}
            </span>
            <LineScopeStatusBadge status={combo.lineScopeStatus} />
            <PublishStatusBadge status={combo.publishStatus} />
          </div>
        )}

        {showQuantities && (
          <span className="shrink-0 text-right font-mono text-sm text-slate-600">
            {isEditing && comboInputs ? (
              <input
                className="w-16 bg-transparent text-right font-mono text-sm outline-none"
                value={comboInputs.quantity}
                onChange={(e) => handleInputChange(comboKey, 'quantity', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey: comboKey, field: 'quantity' })}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              combo.quantity ?? ''
            )}
          </span>
        )}

        {showPricing && (
          <span className={cn('shrink-0 text-sm font-medium tabular-nums text-slate-800', assemblyContentDisabled.pricing && 'opacity-30')}>
            {assemblyContentDisabled.pricing ? '—' : formatCurrency(comboTotal)}
          </span>
        )}

        {enableLineNotes && combo.id && actions.onEditLineNote && (
          <span onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-7 w-7 p-0', combo.note && 'text-amber-600 hover:text-amber-700')}
              title={combo.note ? `Edit notes for ${comboName}` : `Add notes for ${comboName}`}
              onClick={() => actions.onEditLineNote!({ targetType: 'combo', targetId: combo.id!, label: comboName, note: combo.note })}
            >
              <StickyNote className={cn('h-3.5 w-3.5', combo.note && 'fill-amber-100')} />
            </Button>
          </span>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          {!isReadOnly && actions.onDeleteCombo && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-200/80">
                <MoreVertical className="h-4 w-4 text-slate-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => combo.id && actions.onDeleteCombo?.(combo.id)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete assembly
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </NoteHoverWrap>

      {/* Assembly child items */}
      {!isCollapsed && visibleComboItems.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-100">
          <LineItemsTableShell
            showOverrides={showColumnVisibilityToggles}
            overrides={
              <HeaderVisibilityToggles
                isOverridden={isHeaderOverridden(comboKey)}
                onToggleOverride={() => toggleHeaderOverride(comboKey, parentQty, parentPrice)}
                showQuantities={resolvedAssembly.showQuantities}
                showPricing={resolvedAssembly.showPricing}
                onToggleQuantities={() => toggleHeaderField(comboKey, 'showQuantities', resolvedAssembly.showQuantities)}
                onTogglePricing={() => toggleHeaderField(comboKey, 'showPricing', resolvedAssembly.showPricing)}
                colorScheme="slate"
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
              showNotesColumn={showAssemblyNotesColumn}
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
              showNotesColumn={showAssemblyNotesColumn}
            />
            <tbody className="divide-y divide-slate-50">
              {visibleComboItems.map((item, idx) => (
                <ItemRow
                  key={`${comboKey}-item-${item.id ?? idx}`}
                  item={item}
                  rowKey={`${comboKey}-item-${item.id ?? idx}`}
                  indented
                  parentShowQuantities={showQuantities}
                  parentShowPricing={showPricing}
                  contentDisabled={assemblyContentDisabled}
                />
              ))}
            </tbody>
          </table>
          </LineItemsTableShell>
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
