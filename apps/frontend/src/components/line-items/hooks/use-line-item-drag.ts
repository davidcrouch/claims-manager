import { useCallback, useRef, useState } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { ApiGroup, DragState, DropIndicator } from '../lib/types';
import { parseRowKey } from '../lib/row-keys';
import { getInsertPosition, resolveDrop } from '../lib/drop-target';

export interface ReorderParams {
  groupId: string;
  parentComboId?: string;
  items?: Array<{ id: string; sortIndex: number }>;
  combos?: Array<{ id: string; sortIndex: number }>;
  scopes?: Array<{ id: string; sortIndex: number }>;
}

export interface MoveParams {
  itemId?: string;
  comboId?: string;
  targetGroupId: string;
  targetComboId?: string;
  insertAtIndex?: number;
}

export interface UseLineItemDragOptions {
  groups: ApiGroup[];
  onReorderLineItems?: (params: ReorderParams) => void;
  onMoveLineItem?: (params: MoveParams) => void;
  onDuplicateLineItem?: (params: MoveParams) => void;
  disabled?: boolean;
}

export interface UseLineItemDragReturn {
  activeDrag: DragState | null;
  dropIndicator: DropIndicator | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

/**
 * Hook that manages dnd-kit drag state, drop indicators, and reorder/move actions.
 */
export function useLineItemDrag({
  groups,
  onReorderLineItems,
  onMoveLineItem,
  onDuplicateLineItem,
  disabled = false,
}: UseLineItemDragOptions): UseLineItemDragReturn {
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const ctrlKeyRef = useRef(false);

  const clearDrag = useCallback(() => {
    dragStateRef.current = null;
    setActiveDrag(null);
    setDropIndicator(null);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (disabled) return;
      const rowKey = String(event.active.id);
      const parsed = parseRowKey(rowKey);
      if (!parsed) return;

      const activatorEvent = event.activatorEvent as MouseEvent | KeyboardEvent | undefined;
      ctrlKeyRef.current = !!(
        activatorEvent &&
        ('ctrlKey' in activatorEvent ? activatorEvent.ctrlKey || activatorEvent.metaKey : false)
      );

      const state: DragState = {
        rowKey,
        type: parsed.type,
        id: parsed.id,
        parentGroupId: parsed.groupId,
        parentComboId: parsed.parentComboId,
      };
      dragStateRef.current = state;
      setActiveDrag(state);
      setDropIndicator(null);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const source = dragStateRef.current;
      if (!source || disabled || !event.over) {
        setDropIndicator(null);
        return;
      }

      const overId = String(event.over.id);
      if (overId === source.rowKey) {
        setDropIndicator(null);
        return;
      }

      const translated = event.active.rect.current.translated;
      const position = translated
        ? getInsertPosition(event.over.rect.top, event.over.rect.height, translated.top + translated.height / 2)
        : 'before';

      const resolution = resolveDrop(source, overId, groups, position);
      if (!resolution) {
        setDropIndicator(null);
        return;
      }

      setDropIndicator({
        targetKey: resolution.targetRowKey,
        position: resolution.isContainerDrop ? 'after' : position,
        valid: resolution.valid,
        isCopy: ctrlKeyRef.current,
      });
    },
    [disabled, groups],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const source = dragStateRef.current;
      clearDrag();
      if (!source || disabled) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const translated = active.rect.current.translated;
      const position = translated
        ? getInsertPosition(over.rect.top, over.rect.height, translated.top + translated.height / 2)
        : 'before';

      const resolution = resolveDrop(source, String(over.id), groups, position);
      if (!resolution?.valid) return;

      if (resolution.sameParent && onReorderLineItems) {
        const container = findContainer(groups, source.parentGroupId, source.parentComboId, source.type);
        if (
          !container ||
          resolution.reorderFromIndex === undefined ||
          resolution.reorderToIndex === undefined
        ) {
          return;
        }
        const reordered = arrayMove(container, resolution.reorderFromIndex, resolution.reorderToIndex);
        if (source.type === 'item') {
          onReorderLineItems({
            groupId: source.parentGroupId,
            parentComboId: source.parentComboId,
            items: reordered.map((item, idx) => ({ id: item.id!, sortIndex: idx })),
          });
        } else if (source.type === 'scope') {
          onReorderLineItems({
            groupId: source.parentGroupId,
            scopes: reordered.map((scope, idx) => ({ id: scope.id!, sortIndex: idx })),
          });
        } else {
          onReorderLineItems({
            groupId: source.parentGroupId,
            parentComboId: source.parentComboId,
            combos: reordered.map((combo, idx) => ({ id: combo.id!, sortIndex: idx })),
          });
        }
        return;
      }

      const moveParams: MoveParams = {
        itemId: source.type === 'item' ? source.id : undefined,
        comboId: source.type !== 'item' ? source.id : undefined,
        targetGroupId: resolution.targetGroupId,
        targetComboId: resolution.targetComboId,
        insertAtIndex: resolution.insertAtIndex,
      };

      if (ctrlKeyRef.current && onDuplicateLineItem) {
        onDuplicateLineItem(moveParams);
      } else if (onMoveLineItem) {
        onMoveLineItem(moveParams);
      }
    },
    [clearDrag, disabled, groups, onDuplicateLineItem, onMoveLineItem, onReorderLineItems],
  );

  const handleDragCancel = useCallback(() => {
    clearDrag();
  }, [clearDrag]);

  return {
    activeDrag,
    dropIndicator,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}

function findContainer(
  groups: ApiGroup[],
  groupId: string,
  comboId: string | undefined,
  sourceType: DragState['type'],
): Array<{ id?: string }> | null {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return null;

  if (sourceType === 'scope') return group.scopes ?? null;
  if (sourceType === 'assembly' && !comboId) return group.combos ?? null;
  if (!comboId) return group.items ?? null;

  if (sourceType === 'assembly') {
    for (const scope of group.scopes ?? []) {
      if (scope.id === comboId) return scope.combos ?? null;
    }
  }

  for (const combo of group.combos ?? []) {
    if (combo.id === comboId) return combo.items ?? null;
  }
  for (const scope of group.scopes ?? []) {
    if (scope.id === comboId) return scope.items ?? null;
    for (const combo of scope.combos ?? []) {
      if (combo.id === comboId) return combo.items ?? null;
    }
  }
  return null;
}
