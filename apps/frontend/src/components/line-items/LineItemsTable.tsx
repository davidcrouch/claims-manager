'use client';

import { useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { TablePagination } from '@/components/shared/table-pagination';
import { useLineItems } from './LineItemsProvider';
import { useLineItemDrag } from './hooks/use-line-item-drag';
import { useCatalogDrop } from './hooks/use-catalog-drop';
import { LINE_ITEMS_PAGE_SIZE } from './hooks/use-line-item-paging';
import { LineItemsToolbar } from './LineItemsToolbar';
import { GroupCard } from './GroupCard';
import { LineItemDragOverlay } from './DragOverlay';
import { LineItemsDragProvider } from './LineItemsDragContext';

interface LineItemsTableProps {
  hideToolbarActions?: boolean;
}

/**
 * Main table shell. Wraps groups in a DndContext for drag-and-drop
 * and renders the toolbar, group cards, and pagination.
 */
export function LineItemsTable({ hideToolbarActions = false }: LineItemsTableProps) {
  const {
    groups,
    pagedGroups,
    totalUnits,
    config,
    isReadOnly,
    currentPage,
    searchTerm,
    editState,
    actions,
    setPage,
    setEditState,
    setSelectedRows,
  } = useLineItems();

  const { labels } = config;

  const { isOver: isTableDropOver, dropHandlers: tableDropHandlers } = useCatalogDrop({
    target: 'table',
    onGroupLabelDrop: actions.onGroupLabelDrop,
    disabled: isReadOnly || !actions.onGroupLabelDrop,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const {
    activeDrag,
    dropIndicator,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useLineItemDrag({
    groups,
    onReorderLineItems: actions.onReorderLineItems,
    onMoveLineItem: actions.onMoveLineItem,
    onDuplicateLineItem: actions.onDuplicateLineItem,
    disabled: isReadOnly,
  });

  const dragContextValue = useMemo(
    () => ({ activeDrag, dropIndicator }),
    [activeDrag, dropIndicator],
  );

  useEffect(() => {
    if (!editState) return;
    function onMouseDown(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('tr[data-item-row]')) return;
      if ((e.target as HTMLElement).closest('[data-composite-row]')) return;
      if ((e.target as HTMLElement).closest('[data-slot="line-items-toolbar"]')) return;
      setEditState(null);
      setSelectedRows(new Set());
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [editState, setEditState, setSelectedRows]);

  const pageSize = LINE_ITEMS_PAGE_SIZE;

  if (groups.length === 0 && totalUnits === 0) {
    return (
      <div
        className={cn(
          'min-h-[calc(100vh-12rem)] space-y-3 rounded-xl border-2 border-dashed p-1',
          isTableDropOver ? 'border-blue-400 bg-blue-50/20' : 'border-transparent',
        )}
        {...tableDropHandlers}
      >
        {!hideToolbarActions && actions.onOpenCatalogDrawer && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={actions.onOpenCatalogDrawer}>
              <Package className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500">
          <p>{labels.emptyState}</p>
          {actions.onOpenCatalogDrawer && (
            <Button size="sm" variant="outline" onClick={actions.onOpenCatalogDrawer}>
              <Package className="mr-1.5 h-4 w-4" />
              Open catalogue
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border-2 border-dashed p-1',
        isTableDropOver ? 'border-blue-400 bg-blue-50/20' : 'border-transparent',
        !config.compact && 'min-h-[calc(100vh-12rem)]',
      )}
      {...tableDropHandlers}
    >
      <LineItemsToolbar hideActions={hideToolbarActions} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <LineItemsDragProvider value={dragContextValue}>
          <div className="space-y-3">
            {pagedGroups.length === 0 && searchTerm && (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-sm text-slate-400">
                No line items match &ldquo;{searchTerm}&rdquo;
              </div>
            )}
            {pagedGroups.map((group, idx) => (
              <GroupCard
                key={group.id ?? `group-${idx}`}
                group={group}
                groupIndex={idx}
                totalGroups={pagedGroups.length}
              />
            ))}
          </div>

          <LineItemDragOverlay dragState={activeDrag} groups={groups} />
        </LineItemsDragProvider>
      </DndContext>

      <TablePagination
        page={currentPage}
        pageSize={pageSize}
        total={totalUnits}
        onPageChange={setPage}
      />
    </div>
  );
}
