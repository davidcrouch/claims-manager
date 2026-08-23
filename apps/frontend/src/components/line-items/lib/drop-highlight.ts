import { getTargetContext, parseGroupDropKey } from './row-keys';
import { useLineItemsDrag } from '../LineItemsDragContext';

export type DropHighlightKind = 'group' | 'scope' | 'assembly';

/** One shade darker than each composite header (group blue-100, scope violet-50, assembly slate-100). */
export const DROP_TARGET_HIGHLIGHT: Record<DropHighlightKind, string> = {
  group: 'bg-blue-200',
  scope: 'bg-violet-100',
  assembly: 'bg-slate-200',
};

function inferItemDropKind(rowKey: string): DropHighlightKind {
  if (rowKey.match(/-scope-[0-9a-f-]{36}-combo-.*-item-/)) return 'assembly';
  if (rowKey.includes('-scope-') && rowKey.includes('-item-')) return 'scope';
  if (rowKey.includes('-combo-') && rowKey.includes('-item-')) return 'assembly';
  return 'group';
}

function inferKindFromKey(rowKey: string): DropHighlightKind | null {
  if (parseGroupDropKey(rowKey)) return 'group';
  const ctx = getTargetContext(rowKey);
  if (ctx === 'scope') return 'scope';
  if (ctx === 'assembly') return 'assembly';
  if (ctx === 'item') return inferItemDropKind(rowKey);
  return 'group';
}

/** Background class when this row/card is a valid internal drag drop target. */
export function useDropTargetHighlight(rowKey: string, kind?: DropHighlightKind): string {
  const { activeDrag, dropIndicator } = useLineItemsDrag();
  if (!activeDrag || !dropIndicator?.valid || dropIndicator.targetKey !== rowKey) return '';
  const resolved = kind ?? inferKindFromKey(rowKey);
  if (!resolved) return '';
  return DROP_TARGET_HIGHLIGHT[resolved];
}
