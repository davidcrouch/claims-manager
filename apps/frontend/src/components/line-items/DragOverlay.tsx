'use client';

import { DragOverlay as DndKitDragOverlay } from '@dnd-kit/core';
import { Boxes, Layers, Package } from 'lucide-react';
import type { DragState, ApiGroup } from './lib/types';

interface LineItemDragOverlayProps {
  dragState: DragState | null;
  groups: ApiGroup[];
}

/**
 * Custom drag preview rendered in a portal above the page.
 * Shows a compact card with the item/assembly/scope name being dragged.
 */
export function LineItemDragOverlay({ dragState, groups }: LineItemDragOverlayProps) {
  if (!dragState) {
    return <DndKitDragOverlay dropAnimation={null} />;
  }

  const label = findLabel(groups, dragState);

  return (
    <DndKitDragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-lg">
        {dragState.type === 'scope' && <Layers className="h-4 w-4 text-violet-500" />}
        {dragState.type === 'assembly' && <Boxes className="h-4 w-4 text-slate-500" />}
        {dragState.type === 'item' && <Package className="h-4 w-4 text-slate-400" />}
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="text-xs text-slate-400">({dragState.type})</span>
      </div>
    </DndKitDragOverlay>
  );
}

function findLabel(groups: ApiGroup[], drag: DragState): string {
  for (const g of groups) {
    if (drag.type === 'item') {
      for (const item of g.items ?? []) {
        if (item.id === drag.id) return item.name ?? 'Item';
      }
      for (const combo of g.combos ?? []) {
        for (const item of combo.items ?? []) {
          if (item.id === drag.id) return item.name ?? 'Item';
        }
      }
      for (const scope of g.scopes ?? []) {
        for (const item of scope.items ?? []) {
          if (item.id === drag.id) return item.name ?? 'Item';
        }
        for (const combo of scope.combos ?? []) {
          for (const item of combo.items ?? []) {
            if (item.id === drag.id) return item.name ?? 'Item';
          }
        }
      }
    }
    if (drag.type === 'assembly') {
      for (const combo of g.combos ?? []) {
        if (combo.id === drag.id) return combo.name ?? 'Assembly';
      }
      for (const scope of g.scopes ?? []) {
        for (const combo of scope.combos ?? []) {
          if (combo.id === drag.id) return combo.name ?? 'Assembly';
        }
      }
    }
    if (drag.type === 'scope') {
      for (const scope of g.scopes ?? []) {
        if (scope.id === drag.id) return scope.name ?? 'Scope';
      }
    }
  }
  return drag.id;
}
