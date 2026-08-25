import type { ApiGroup, DragState } from './types';
import {
  canDropInTarget,
  getParentContext,
  getTargetContext,
  parseGroupDropKey,
  parseRowKey,
} from './row-keys';

export type InsertPosition = 'before' | 'after';

export interface DropResolution {
  valid: boolean;
  dropContext: 'group' | 'scope' | 'assembly';
  targetGroupId: string;
  targetComboId?: string;
  targetRowKey: string;
  sameParent: boolean;
  insertAtIndex?: number;
  isContainerDrop: boolean;
  reorderFromIndex?: number;
  reorderToIndex?: number;
}

/** Infer insert-before vs insert-after from pointer position over the hovered element. */
export function getInsertPosition(
  overTop: number,
  overHeight: number,
  activeMidY: number,
): InsertPosition {
  const overMidY = overTop + overHeight / 2;
  return activeMidY < overMidY ? 'before' : 'after';
}

export function resolveDrop(
  source: DragState,
  overId: string,
  groups: ApiGroup[],
  position: InsertPosition,
): DropResolution | null {
  const containerGroupId = parseGroupDropKey(overId);
  if (containerGroupId) {
    const valid = canDropInTarget(source.type, 'group');
    return {
      valid,
      dropContext: 'group',
      targetGroupId: containerGroupId,
      targetRowKey: overId,
      sameParent: false,
      isContainerDrop: true,
      insertAtIndex: appendIndex(groups, containerGroupId, source.type),
    };
  }

  const targetParsed = parseRowKey(overId);
  if (!targetParsed) return null;

  if (source.type === 'scope') {
    return resolveScopeDrop(source, overId, targetParsed, groups, position);
  }

  const targetContext = getTargetContext(overId);
  let dropContext: 'group' | 'scope' | 'assembly';
  if (targetContext === 'item') {
    dropContext = getParentContext(overId);
  } else if (targetContext === 'scope' || targetContext === 'assembly') {
    dropContext = source.type === targetContext ? 'group' : targetContext;
  } else {
    dropContext = 'group';
  }

  const valid = canDropInTarget(source.type, dropContext);
  const targetGroupId = targetParsed.groupId;
  const targetComboId =
    (targetContext === 'scope' || targetContext === 'assembly') && source.type === targetContext
      ? targetParsed.parentComboId
      : targetParsed.parentComboId ??
        (targetContext === 'scope' || targetContext === 'assembly' ? targetParsed.id : undefined);

  const sameParent =
    source.parentGroupId === targetParsed.groupId &&
    (source.parentComboId ?? undefined) === (targetParsed.parentComboId ?? undefined) &&
    source.type === targetParsed.type;

  if (sameParent) {
    const container = findContainer(groups, source.parentGroupId, source.parentComboId, source.type);
    if (!container) {
      return {
        valid,
        dropContext,
        targetGroupId,
        targetComboId,
        targetRowKey: overId,
        sameParent: true,
        isContainerDrop: false,
      };
    }
    const fromIndex = container.findIndex((entry) => entry.id === source.id);
    const targetIndex = container.findIndex((entry) => entry.id === targetParsed.id);
    if (fromIndex === -1 || targetIndex === -1) {
      return {
        valid,
        dropContext,
        targetGroupId,
        targetComboId,
        targetRowKey: overId,
        sameParent: true,
        isContainerDrop: false,
      };
    }
    let toIndex = targetIndex;
    if (position === 'after') toIndex += 1;
    if (fromIndex < toIndex) toIndex -= 1;
    return {
      valid,
      dropContext,
      targetGroupId,
      targetComboId,
      targetRowKey: overId,
      sameParent: true,
      isContainerDrop: false,
      reorderFromIndex: fromIndex,
      reorderToIndex: toIndex,
    };
  }

  return {
    valid,
    dropContext,
    targetGroupId,
    targetComboId,
    targetRowKey: overId,
    sameParent: false,
    isContainerDrop: false,
    insertAtIndex: computeInsertIndex(
      groups,
      targetGroupId,
      targetComboId,
      targetParsed,
      source.type,
      position,
    ),
  };
}

/**
 * Scopes can only live in a group. Dropping on a scope (or anything nested
 * under one) retargets to that parent group so the dragged scope is inserted
 * as a sibling, never nested.
 */
function resolveScopeDrop(
  source: DragState,
  overId: string,
  targetParsed: NonNullable<ReturnType<typeof parseRowKey>>,
  groups: ApiGroup[],
  position: InsertPosition,
): DropResolution {
  const targetGroupId = targetParsed.groupId;
  const targetScopeId =
    targetParsed.type === 'scope' ? targetParsed.id : enclosingScopeIdFromKey(overId);

  if (targetScopeId === source.id) {
    return {
      valid: false,
      dropContext: 'group',
      targetGroupId,
      targetRowKey: overId,
      sameParent: true,
      isContainerDrop: false,
    };
  }

  const sameParent = source.parentGroupId === targetGroupId && !!targetScopeId;

  if (sameParent && targetScopeId) {
    const container = findContainer(groups, source.parentGroupId, undefined, 'scope');
    if (!container) {
      return {
        valid: true,
        dropContext: 'group',
        targetGroupId,
        targetRowKey: overId,
        sameParent: true,
        isContainerDrop: false,
      };
    }
    const fromIndex = container.findIndex((entry) => entry.id === source.id);
    const targetIndex = container.findIndex((entry) => entry.id === targetScopeId);
    if (fromIndex === -1 || targetIndex === -1) {
      return {
        valid: true,
        dropContext: 'group',
        targetGroupId,
        targetRowKey: overId,
        sameParent: true,
        isContainerDrop: false,
      };
    }
    let toIndex = targetIndex;
    if (position === 'after') toIndex += 1;
    if (fromIndex < toIndex) toIndex -= 1;
    return {
      valid: true,
      dropContext: 'group',
      targetGroupId,
      targetRowKey: overId,
      sameParent: true,
      isContainerDrop: false,
      reorderFromIndex: fromIndex,
      reorderToIndex: toIndex,
    };
  }

  const insertTarget = targetScopeId
    ? { type: 'scope' as const, id: targetScopeId }
    : targetParsed;

  return {
    valid: true,
    dropContext: 'group',
    targetGroupId,
    targetRowKey: overId,
    sameParent: false,
    isContainerDrop: false,
    insertAtIndex: computeInsertIndex(
      groups,
      targetGroupId,
      undefined,
      insertTarget,
      'scope',
      position,
    ),
  };
}

function enclosingScopeIdFromKey(rowKey: string): string | undefined {
  const match = rowKey.match(/^[0-9a-f-]{36}-scope-([0-9a-f-]{36})/i);
  return match?.[1];
}

function appendIndex(
  groups: ApiGroup[],
  groupId: string,
  sourceType: DragState['type'],
): number | undefined {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return undefined;
  if (sourceType === 'scope') return (group.scopes ?? []).length;
  if (sourceType === 'assembly') return (group.combos ?? []).length;
  return (group.items ?? []).length;
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

function computeInsertIndex(
  groups: ApiGroup[],
  targetGroupId: string,
  targetComboId: string | undefined,
  targetParsed: { type: string; id: string },
  sourceType: string,
  position: InsertPosition,
): number | undefined {
  const group = groups.find((g) => g.id === targetGroupId);
  if (!group) return undefined;

  const adjust = (idx: number, length: number) => {
    if (idx < 0) return length;
    return position === 'after' ? idx + 1 : idx;
  };

  if (sourceType === 'scope') {
    const scopes = group.scopes ?? [];
    return adjust(
      scopes.findIndex((scope) => scope.id === targetParsed.id),
      scopes.length,
    );
  }

  if (sourceType === 'assembly') {
    if (targetComboId) {
      const scope = (group.scopes ?? []).find((entry) => entry.id === targetComboId);
      if (scope) {
        const combos = scope.combos ?? [];
        return adjust(
          combos.findIndex((combo) => combo.id === targetParsed.id),
          combos.length,
        );
      }
    }
    const combos = group.combos ?? [];
    return adjust(
      combos.findIndex((combo) => combo.id === targetParsed.id),
      combos.length,
    );
  }

  if (targetComboId) {
    const items = findContainer(groups, targetGroupId, targetComboId, 'item');
    if (items) {
      return adjust(
        items.findIndex((item) => item.id === targetParsed.id),
        items.length,
      );
    }
  }

  const items = group.items ?? [];
  return adjust(
    items.findIndex((item) => item.id === targetParsed.id),
    items.length,
  );
}
