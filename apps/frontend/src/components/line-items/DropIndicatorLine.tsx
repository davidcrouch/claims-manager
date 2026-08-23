'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { useLineItemsDrag } from './LineItemsDragContext';
import { useDropTargetHighlight } from './lib/drop-highlight';

interface DropIndicatorLineProps {
  rowKey: string;
  variant?: 'row' | 'card';
}

/**
 * Renders a blue/green insertion line when this row/card is the current drop target.
 */
export function DropIndicatorLine({ rowKey, variant = 'row' }: DropIndicatorLineProps) {
  const { dropIndicator } = useLineItemsDrag();
  if (!dropIndicator || dropIndicator.targetKey !== rowKey || !dropIndicator.valid) return null;

  const color = dropIndicator.isCopy ? 'bg-emerald-500' : 'bg-blue-500';

  if (variant === 'card') {
    return (
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-2 right-2 z-20 h-0.5 rounded-full',
          color,
          dropIndicator.position === 'before' ? 'top-0' : 'bottom-0',
        )}
      />
    );
  }

  return (
    <td colSpan={100} className="relative h-0 p-0">
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-0 right-0 z-20 h-0.5',
          color,
          dropIndicator.position === 'before' ? '-top-px' : '-bottom-px',
        )}
      />
    </td>
  );
}

/** Returns border styles for table rows / cards when they are the active drop target. */
export function useDropIndicatorBorder(rowKey: string): CSSProperties | undefined {
  const { dropIndicator } = useLineItemsDrag();
  if (!dropIndicator || dropIndicator.targetKey !== rowKey || !dropIndicator.valid) return undefined;

  const color = dropIndicator.isCopy ? '#16a34a' : '#2563eb';
  if (dropIndicator.position === 'before') {
    return { boxShadow: `inset 0 2px 0 0 ${color}` };
  }
  return { boxShadow: `inset 0 -2px 0 0 ${color}` };
}

/** Whether a group container drop zone is active (valid internal drag onto group). */
export function useGroupContainerDropActive(groupDropKey: string): boolean {
  return useDropTargetHighlight(groupDropKey, 'group') !== '';
}
