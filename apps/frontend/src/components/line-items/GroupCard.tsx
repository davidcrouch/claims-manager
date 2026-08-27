'use client';

import { memo, useCallback, useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import {
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Pencil,
  StickyNote,
  Trash2,
} from 'lucide-react';
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
import { useCatalogDrop } from './hooks/use-catalog-drop';
import { useDropTargetHighlight } from './lib/drop-highlight';
import { computeItemMoney, groupLabel } from './lib/money';
import { groupDropKey } from './lib/row-keys';
import { RowLeadCheckbox, RowLeadDrag, RowLeadExpand, ROW_LEAD_ROW_CLS } from './lib/row-lead';
import { GroupDimensionFields } from './GroupDimensionFields';
import type { ApiGroup } from './lib/types';
import { ItemRow } from './ItemRow';
import { AssemblyRow } from './AssemblyRow';
import { ScopeCard } from './ScopeCard';
import { LI_HEADER_COUNT, LI_HEADER_TOTAL, LineItemsColGroup, LineItemsThead, LineItemsTableShell } from './lib/table-parts';
import { HeaderVisibilityToggles } from './lib/header-visibility';
import { NoteHoverWrap } from './lib/line-note-hover';
import { filterVisibleItems, isSelectablePicked } from './lib/selection-filter';

interface GroupCardProps {
  group: ApiGroup;
  groupIndex: number;
  totalGroups: number;
}

export const GroupCard = memo(function GroupCard({ group, groupIndex, totalGroups }: GroupCardProps) {
  const {
    config,
    isReadOnly,
    editInputs,
    collapsed,
    collapsedCombos,
    collapsedScopes,
    selection,
    bulkSelectedIds,
    actions,
    toggleCollapse,
    toggleCombo,
    toggleScope,
    handleBulkToggle,
    hideUnselected,
    resolveHeaderVisibility,
    isHeaderOverridden,
    toggleHeaderOverride,
    toggleHeaderField,
  } = useLineItems();

  const {
    showMarkup,
    showGst,
    showQuantities,
    showPricing,
    showCategory,
    enableLineNotes,
    mode,
    labels,
    showColumnVisibilityToggles,
  } = config;
  const gId = group.id ?? `group-${groupIndex}`;
  const isCollapsed = collapsed.has(gId);
  const label = groupLabel(group, groupIndex);
  const items = group.items ?? [];
  const combos = group.combos ?? [];
  const scopes = group.scopes ?? [];
  const resolvedGroup = resolveHeaderVisibility(gId, showQuantities, showPricing);
  const visibleItems = filterVisibleItems(items, hideUnselected, selection?.selectedIds);
  const hasContent = items.length > 0 || combos.length > 0 || scopes.length > 0;
  const showDragHandle = !isReadOnly && !!actions.onReorderLineItems;
  const showSelect = !!selection;
  const showBulkSelect = !isReadOnly && !showSelect;

  const allSelectableIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) if (item.id) ids.push(item.id);
    for (const combo of combos) {
      if (combo.id) ids.push(combo.id);
      for (const item of combo.items ?? []) if (item.id) ids.push(item.id);
    }
    for (const scope of scopes) {
      if (scope.id) ids.push(scope.id);
      for (const item of scope.items ?? []) if (item.id) ids.push(item.id);
      for (const combo of scope.combos ?? []) {
        if (combo.id) ids.push(combo.id);
        for (const item of combo.items ?? []) if (item.id) ids.push(item.id);
      }
    }
    return ids;
  }, [items, combos, scopes]);

  const groupPickState: boolean | 'indeterminate' = useMemo(() => {
    if (!selection || allSelectableIds.length === 0) return false;
    const count = allSelectableIds.filter((id) => selection.selectedIds.has(id)).length;
    if (count === 0) return false;
    if (count === allSelectableIds.length) return true;
    return 'indeterminate';
  }, [selection, allSelectableIds]);

  const { isOver: isCatalogOver, dropHandlers } = useCatalogDrop({
    target: 'group',
    groupId: group.id,
    onCatalogDrop: actions.onCatalogDrop,
    onGroupLabelDrop: actions.onGroupLabelDrop,
    disabled: isReadOnly || !actions.onCatalogDrop,
  });

  const containerDropId = groupDropKey(gId);
  const { setNodeRef: setContainerDropRef } = useDroppable({
    id: containerDropId,
    disabled: isReadOnly || !actions.onReorderLineItems,
  });
  const isContainerDropActive = useDropTargetHighlight(containerDropId, 'group') !== '';

  const setGroupRef = useCallback(
    (node: HTMLDivElement | null) => {
      setContainerDropRef(node);
    },
    [setContainerDropRef],
  );

  const totalLineCount =
    items.length +
    combos.reduce((sum, c) => sum + (c.items?.length ?? 0), 0) +
    scopes.reduce((sum, s) => sum + (s.items?.length ?? 0) + (s.combos ?? []).reduce((cs, c) => cs + (c.items?.length ?? 0), 0), 0);

  const groupTotal = useMemo(() => {
    let sum = 0;
    for (let ii = 0; ii < items.length; ii++) {
      const item = items[ii];
      if (hideUnselected && !isSelectablePicked(item.id, selection?.selectedIds)) continue;
      sum += computeItemMoney(item, editInputs[`${gId}-item-${item.id ?? ii}`], showMarkup, showGst).total;
    }
    for (let ci = 0; ci < combos.length; ci++) {
      const combo = combos[ci];
      const comboKey = `${gId}-combo-${combo.id ?? ci}`;
      for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
        const item = combo.items![ii];
        if (hideUnselected && !isSelectablePicked(item.id, selection?.selectedIds)) continue;
        sum += computeItemMoney(item, editInputs[`${comboKey}-item-${item.id ?? ii}`], showMarkup, showGst).total;
      }
    }
    for (let si = 0; si < scopes.length; si++) {
      const scope = scopes[si];
      const scopeKey = `${gId}-scope-${scope.id ?? si}`;
      for (let ii = 0; ii < (scope.items ?? []).length; ii++) {
        const item = scope.items![ii];
        if (hideUnselected && !isSelectablePicked(item.id, selection?.selectedIds)) continue;
        sum += computeItemMoney(item, editInputs[`${scopeKey}-item-${item.id ?? ii}`], showMarkup, showGst).total;
      }
      for (let ci = 0; ci < (scope.combos ?? []).length; ci++) {
        const combo = scope.combos![ci];
        const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
        for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
          const item = combo.items![ii];
          if (hideUnselected && !isSelectablePicked(item.id, selection?.selectedIds)) continue;
          sum += computeItemMoney(item, editInputs[`${comboKey}-item-${item.id ?? ii}`], showMarkup, showGst).total;
        }
      }
    }
    return sum;
  }, [items, combos, scopes, gId, showMarkup, showGst, editInputs, hideUnselected, selection?.selectedIds]);

  const showGroupPricing = showColumnVisibilityToggles ? resolvedGroup.showPricing : showPricing;
  const showGroupNotesColumn = enableLineNotes && !showGroupPricing;

  const sortableIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(`${gId}-item-${item.id ?? ids.length}`);
    }
    for (const combo of combos) {
      const comboKey = `${gId}-combo-${combo.id ?? ids.length}`;
      ids.push(comboKey);
      for (const item of combo.items ?? []) {
        ids.push(`${comboKey}-item-${item.id ?? ids.length}`);
      }
    }
    for (const scope of scopes) {
      const scopeKey = `${gId}-scope-${scope.id ?? ids.length}`;
      ids.push(scopeKey);
      for (const item of scope.items ?? []) {
        ids.push(`${scopeKey}-item-${item.id ?? ids.length}`);
      }
      for (const combo of scope.combos ?? []) {
        const comboKey = `${scopeKey}-combo-${combo.id ?? ids.length}`;
        ids.push(comboKey);
        for (const item of combo.items ?? []) {
          ids.push(`${comboKey}-item-${item.id ?? ids.length}`);
        }
      }
    }
    return ids;
  }, [items, combos, scopes, gId]);

  const groupDropHighlight = useDropTargetHighlight(containerDropId, 'group');

  return (
    <div
      ref={setGroupRef}
      className={cn(
        'overflow-hidden rounded-lg border shadow-sm transition-colors',
        isCatalogOver
          ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50/30'
          : groupDropHighlight
            ? groupDropHighlight
            : 'border-slate-200',
      )}
      {...dropHandlers}
    >
      {/* Group header — grab, checkbox, expand, then content */}
      <NoteHoverWrap
        note={group.note}
        enabled={enableLineNotes}
        className={cn(
          ROW_LEAD_ROW_CLS,
          'relative cursor-pointer bg-blue-100 py-3 pr-3 transition-colors hover:bg-blue-200',
        )}
        onClick={() => toggleCollapse(gId)}
        data-composite-row
      >
        <RowLeadDrag
          show={showDragHandle}
          iconClassName="text-blue-400 hover:text-blue-600"
        />

        <RowLeadCheckbox
          show={showBulkSelect || showSelect}
          checked={showBulkSelect
            ? allSelectableIds.length > 0 && allSelectableIds.every((id) => bulkSelectedIds.has(id))
            : groupPickState === true}
          indeterminate={showBulkSelect
            ? allSelectableIds.some((id) => bulkSelectedIds.has(id)) &&
              !allSelectableIds.every((id) => bulkSelectedIds.has(id))
            : groupPickState === 'indeterminate'}
          onCheckedChange={() => {
            if (showBulkSelect) handleBulkToggle(allSelectableIds);
            else selection?.onChange(toggleIds(selection.selectedIds, allSelectableIds));
          }}
          aria-label={`Select all items in ${label}`}
        />

        <RowLeadExpand show isCollapsed={isCollapsed} iconClassName="text-blue-600" />

        <div className="flex min-w-0 flex-1 items-center">
          <span className="truncate text-sm font-semibold text-blue-950">{label}</span>
          {group.description && label !== group.description && (
            <span className="ml-2 truncate text-xs text-blue-700">{group.description}</span>
          )}
          {mode !== 'catalog' && group.id && (
            <GroupDimensionFields
              groupId={group.id}
              length={group.length}
              width={group.width}
              height={group.height}
              perimeter={group.perimeter}
              disabled={isReadOnly}
              onSave={actions.onUpdateGroupDimensions}
            />
          )}
        </div>

        <span className={cn(LI_HEADER_COUNT, 'text-blue-700')}>
          {totalLineCount} item{totalLineCount !== 1 ? 's' : ''}
          {scopes.length > 0 && ` · ${scopes.length} scope${scopes.length !== 1 ? 's' : ''}`}
          {combos.length > 0 && ` · ${combos.length} assembl${combos.length !== 1 ? 'ies' : 'y'}`}
        </span>

        {showGroupPricing && (
          <span className={cn(LI_HEADER_TOTAL, 'text-blue-900')}>
            {formatCurrency(groupTotal)}
          </span>
        )}

        {enableLineNotes && group.id && actions.onEditLineNote && (
          <span onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-7 w-7 p-0', group.note && 'text-amber-600 hover:text-amber-700')}
              title={group.note ? `Edit notes for ${label}` : `Add notes for ${label}`}
              onClick={() => actions.onEditLineNote!({ targetType: 'group', targetId: group.id!, label, note: group.note })}
            >
              <StickyNote className={cn('h-3.5 w-3.5', group.note && 'fill-amber-100')} />
            </Button>
          </span>
        )}

        {!isReadOnly && (actions.onEditGroup || actions.onDeleteGroup || actions.onMoveGroupUp || actions.onMoveGroupDown) && (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-blue-200/80">
                <MoreVertical className="h-4 w-4 text-blue-800" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.onMoveGroupUp && groupIndex > 0 && (
                  <DropdownMenuItem onClick={() => actions.onMoveGroupUp?.(gId)}>
                    <ArrowUp className="mr-2 h-4 w-4" /> Move up
                  </DropdownMenuItem>
                )}
                {actions.onMoveGroupDown && groupIndex < totalGroups - 1 && (
                  <DropdownMenuItem onClick={() => actions.onMoveGroupDown?.(gId)}>
                    <ArrowDown className="mr-2 h-4 w-4" /> Move down
                  </DropdownMenuItem>
                )}
                {actions.onEditGroup && (
                  <DropdownMenuItem onClick={() => actions.onEditGroup?.(gId)}>
                    <Pencil className="mr-2 h-4 w-4" /> {labels.editGroup}
                  </DropdownMenuItem>
                )}
                {actions.onDeleteGroup && (
                  <DropdownMenuItem className="text-red-600" onClick={() => actions.onDeleteGroup?.(gId)}>
                    <Trash2 className="mr-2 h-4 w-4" /> {labels.deleteGroup}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </NoteHoverWrap>

      {/* Group content */}
      {!isCollapsed && (
        hasContent ? (
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="mx-1 space-y-0">
            {/* Group-level items */}
            {visibleItems.length > 0 && (
              <div className="overflow-x-auto">
                <LineItemsTableShell
                  showOverrides={showColumnVisibilityToggles}
                  overrides={
                    <HeaderVisibilityToggles
                      isOverridden={isHeaderOverridden(gId)}
                      onToggleOverride={() => toggleHeaderOverride(gId, showQuantities, showPricing)}
                      showQuantities={resolvedGroup.showQuantities}
                      showPricing={resolvedGroup.showPricing}
                      onToggleQuantities={() => toggleHeaderField(gId, 'showQuantities', resolvedGroup.showQuantities)}
                      onTogglePricing={() => toggleHeaderField(gId, 'showPricing', resolvedGroup.showPricing)}
                      colorScheme="blue"
                    />
                  }
                >
                <table className="w-full table-fixed divide-y divide-slate-100 text-sm">
                  <LineItemsColGroup
                    showDragHandle={showDragHandle}
                    showBulkSelect={showBulkSelect}
                    showSelect={showSelect}
                    showCategory={showCategory}
                    showQuantities={resolvedGroup.showQuantities}
                    showPricing={resolvedGroup.showPricing}
                    showMarkup={showMarkup}
                    showGst={showGst}
                    showNotesColumn={showGroupNotesColumn}
                  />
                  <LineItemsThead
                    showDragHandle={showDragHandle}
                    showBulkSelect={showBulkSelect}
                    showSelect={showSelect}
                    showCategory={showCategory}
                    showQuantities={resolvedGroup.showQuantities}
                    showPricing={resolvedGroup.showPricing}
                    showMarkup={showMarkup}
                    showGst={showGst}
                    showNotesColumn={showGroupNotesColumn}
                  />
                  <tbody className="divide-y divide-slate-50">
                    {visibleItems.map((item, idx) => (
                      <ItemRow
                        key={`${gId}-item-${item.id ?? idx}`}
                        item={item}
                        rowKey={`${gId}-item-${item.id ?? idx}`}
                        parentShowQuantities={resolvedGroup.showQuantities}
                        parentShowPricing={resolvedGroup.showPricing}
                      />
                    ))}
                  </tbody>
                </table>
                </LineItemsTableShell>
              </div>
            )}

            {/* Group-level assemblies as nested cards */}
            {combos.map((combo, ci) => {
              const comboKey = `${gId}-combo-${combo.id ?? ci}`;
              return (
                <AssemblyRow
                  key={comboKey}
                  combo={combo}
                  comboKey={comboKey}
                  groupId={gId}
                  isCollapsed={collapsedCombos.has(comboKey)}
                  onToggle={() => toggleCombo(comboKey)}
                  parentShowQuantities={resolvedGroup.showQuantities}
                  parentShowPricing={resolvedGroup.showPricing}
                />
              );
            })}

            {/* Scopes as nested cards */}
            {scopes.map((scope, si) => {
              const scopeKey = `${gId}-scope-${scope.id ?? si}`;
              return (
                <ScopeCard
                  key={scopeKey}
                  scope={scope}
                  scopeKey={scopeKey}
                  groupId={gId}
                  isCollapsed={collapsedScopes.has(scopeKey)}
                  onToggle={() => toggleScope(scopeKey)}
                  parentShowQuantities={resolvedGroup.showQuantities}
                  parentShowPricing={resolvedGroup.showPricing}
                />
              );
            })}
          </div>
        </SortableContext>
        ) : (
        <div
          className={cn(
            'flex items-center justify-center py-8 text-sm transition-colors',
            isContainerDropActive ? 'text-blue-800' : 'text-slate-400',
          )}
        >
          {labels.dragHint}
        </div>
        )
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
