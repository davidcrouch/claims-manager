import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogDropTarget } from '@/components/catalog/catalog-drag';
import {
  getCatalogDragData,
  getGroupLabelDragData,
  getCatalogDragOverDecision,
  resolveCatalogDropDestination,
  clearCatalogDrag,
} from '@/components/catalog/catalog-drag';
import type { CatalogDragPayload, GroupLabelDragPayload } from '@/components/catalog/catalog-drag';

export interface UseCatalogDropOptions {
  target: CatalogDropTarget;
  groupId?: string;
  quoteComboId?: string;
  onCatalogDrop?: (payload: CatalogDragPayload, groupId?: string, quoteComboId?: string) => void;
  onGroupLabelDrop?: (payload: GroupLabelDragPayload) => void;
  disabled?: boolean;
}

export interface UseCatalogDropReturn {
  isOver: boolean;
  dropHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Catalogue HTML5 drop-zone highlight.
 *
 * Nested zones (group → scope → assembly) stopPropagation on highlight so the
 * deepest valid target wins. Highlight is re-asserted on dragover; dragleave
 * only clears on the next animation frame so crossing children / bubbled leaves
 * do not permanently clear a parent that is still the active drop target.
 */
export function useCatalogDrop({
  target,
  groupId,
  quoteComboId,
  onCatalogDrop,
  onGroupLabelDrop,
  disabled = false,
}: UseCatalogDropOptions): UseCatalogDropReturn {
  const [isOver, setIsOver] = useState(false);
  const clearRafRef = useRef<number | null>(null);

  const cancelScheduledClear = useCallback(() => {
    if (clearRafRef.current != null) {
      cancelAnimationFrame(clearRafRef.current);
      clearRafRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelScheduledClear(), [cancelScheduledClear]);

  const assertOver = useCallback(() => {
    cancelScheduledClear();
    setIsOver(true);
  }, [cancelScheduledClear]);

  const scheduleClear = useCallback(() => {
    cancelScheduledClear();
    clearRafRef.current = requestAnimationFrame(() => {
      clearRafRef.current = null;
      setIsOver(false);
    });
  }, [cancelScheduledClear]);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      const decision = getCatalogDragOverDecision(e.dataTransfer, target);
      if (!decision.allowDrop) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (decision.highlight) {
        e.stopPropagation();
        assertOver();
      }
    },
    [target, disabled, assertOver],
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      const decision = getCatalogDragOverDecision(e.dataTransfer, target);
      if (!decision.allowDrop) return;
      e.preventDefault();
      if (!decision.highlight) return;
      e.stopPropagation();
      assertOver();
    },
    [target, disabled, assertOver],
  );

  const onDragLeave = useCallback(
    (_e: React.DragEvent) => {
      if (disabled) return;
      // Defer clear so a following dragover on this same zone can cancel it
      // (crossing non-droppable children). Nested highlight zones stopPropagation
      // on dragover, so parents that lost the pointer clear on the next frame.
      scheduleClear();
    },
    [disabled, scheduleClear],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      cancelScheduledClear();
      setIsOver(false);

      const groupLabel = getGroupLabelDragData(e.dataTransfer);
      if (groupLabel && target === 'table') {
        e.preventDefault();
        e.stopPropagation();
        clearCatalogDrag();
        onGroupLabelDrop?.(groupLabel);
        return;
      }

      const catalogPayload = getCatalogDragData(e.dataTransfer);
      if (catalogPayload) {
        const destination = resolveCatalogDropDestination(catalogPayload.kind, target);
        if (!destination) return;
        e.preventDefault();
        e.stopPropagation();
        clearCatalogDrag();
        const nestUnderComboId = destination === 'group' ? undefined : quoteComboId;
        onCatalogDrop?.(catalogPayload, groupId, nestUnderComboId);
      }
    },
    [disabled, target, groupId, quoteComboId, onCatalogDrop, onGroupLabelDrop, cancelScheduledClear],
  );

  return {
    isOver,
    dropHandlers: { onDragOver, onDragEnter, onDragLeave, onDrop },
  };
}
