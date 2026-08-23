import { useCallback, useRef, useState } from 'react';
import type { CatalogDropTarget } from '@/components/catalog/catalog-drag';
import {
  getCatalogDragData,
  getGroupLabelDragData,
  shouldAcceptCatalogDragOver,
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

export function useCatalogDrop({
  target,
  groupId,
  quoteComboId,
  onCatalogDrop,
  onGroupLabelDrop,
  disabled = false,
}: UseCatalogDropOptions): UseCatalogDropReturn {
  const [isOver, setIsOver] = useState(false);
  const enterCountRef = useRef(0);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (shouldAcceptCatalogDragOver(e.dataTransfer, target)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [target, disabled],
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      if (shouldAcceptCatalogDragOver(e.dataTransfer, target)) {
        e.preventDefault();
        e.stopPropagation();
        enterCountRef.current += 1;
        setIsOver(true);
      }
    },
    [target, disabled],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      enterCountRef.current -= 1;
      if (enterCountRef.current <= 0) {
        enterCountRef.current = 0;
        setIsOver(false);
      }
    },
    [disabled],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      enterCountRef.current = 0;
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
        e.preventDefault();
        e.stopPropagation();
        clearCatalogDrag();
        onCatalogDrop?.(catalogPayload, groupId, quoteComboId);
      }
    },
    [disabled, target, groupId, quoteComboId, onCatalogDrop, onGroupLabelDrop],
  );

  return {
    isOver,
    dropHandlers: { onDragOver, onDragEnter, onDragLeave, onDrop },
  };
}
