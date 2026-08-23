import type { ApiCombo, ApiGroup, ApiItem, ApiScope } from './types';

/**
 * Pure functions for optimistic reorder/move operations on the group tree.
 * These produce new arrays without mutating the originals.
 */

/** Reorder items within a group by moving fromIndex to toIndex. */
export function reorderGroupItems(
  groups: ApiGroup[],
  groupId: string,
  fromIndex: number,
  toIndex: number,
): ApiGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    const items = [...(g.items ?? [])];
    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return g;
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    return { ...g, items };
  });
}

/** Apply reorder API params optimistically to the group tree. */
export function applyReorderParams(
  groups: ApiGroup[],
  params: {
    groupId: string;
    parentComboId?: string;
    items?: Array<{ id: string; sortIndex: number }>;
    combos?: Array<{ id: string; sortIndex: number }>;
    scopes?: Array<{ id: string; sortIndex: number }>;
  },
): ApiGroup[] {
  if (params.scopes && params.scopes.length > 0) {
    const orderedIds = [...params.scopes].sort((a, b) => a.sortIndex - b.sortIndex).map((s) => s.id);
    return groups.map((g) => {
      if (g.id !== params.groupId) return g;
      return { ...g, scopes: reorderByIds(g.scopes ?? [], orderedIds) };
    });
  }

  if (params.items && params.items.length > 0) {
    const orderedIds = [...params.items].sort((a, b) => a.sortIndex - b.sortIndex).map((i) => i.id);
    if (params.parentComboId) {
      return reorderContainerItems(groups, params.parentComboId, orderedIds);
    }
    return groups.map((g) => {
      if (g.id !== params.groupId) return g;
      return { ...g, items: reorderByIds(g.items ?? [], orderedIds) };
    });
  }

  if (params.combos && params.combos.length > 0) {
    const orderedIds = [...params.combos].sort((a, b) => a.sortIndex - b.sortIndex).map((c) => c.id);
    return groups.map((g) => {
      if (g.id !== params.groupId) return g;
      const scopes = (g.scopes ?? []).map((scope) => {
        if (params.parentComboId && scope.id === params.parentComboId) {
          return { ...scope, combos: reorderByIds(scope.combos ?? [], orderedIds) };
        }
        return scope;
      });
      if (params.parentComboId) {
        return { ...g, scopes };
      }
      return { ...g, combos: reorderByIds(g.combos ?? [], orderedIds), scopes };
    });
  }

  return groups;
}

/** Reorder items within a combo/scope by generating new sortIndex values. */
export function reorderContainerItems(
  groups: ApiGroup[],
  containerId: string,
  orderedIds: string[],
): ApiGroup[] {
  return groups.map((g) => {
    const combos = (g.combos ?? []).map((combo) => {
      if (combo.id === containerId) {
        const items = reorderByIds(combo.items ?? [], orderedIds);
        return { ...combo, items };
      }
      return combo;
    });

    const scopes = (g.scopes ?? []).map((scope) => {
      if (scope.id === containerId) {
        const items = reorderByIds(scope.items ?? [], orderedIds);
        return { ...scope, items };
      }
      const nestedCombos = (scope.combos ?? []).map((combo) => {
        if (combo.id === containerId) {
          const items = reorderByIds(combo.items ?? [], orderedIds);
          return { ...combo, items };
        }
        return combo;
      });
      return { ...scope, combos: nestedCombos };
    });

    return { ...g, combos, scopes };
  });
}

/** Reorder combos within a group. */
export function reorderGroupCombos(
  groups: ApiGroup[],
  groupId: string,
  orderedIds: string[],
): ApiGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    const combos = reorderByIds(g.combos ?? [], orderedIds);
    return { ...g, combos };
  });
}

/** Reorder scopes within a group. */
export function reorderGroupScopes(
  groups: ApiGroup[],
  groupId: string,
  orderedIds: string[],
): ApiGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    const scopes = reorderByIds(g.scopes ?? [], orderedIds);
    return { ...g, scopes };
  });
}

/** Reorder groups themselves by ordered IDs. */
export function reorderGroups(groups: ApiGroup[], orderedIds: string[]): ApiGroup[] {
  const lookup = new Map(groups.map((g) => [g.id, g]));
  const result: ApiGroup[] = [];
  for (const id of orderedIds) {
    const g = lookup.get(id);
    if (g) result.push(g);
  }
  for (const g of groups) {
    if (!orderedIds.includes(g.id!)) result.push(g);
  }
  return result;
}

/** Move an item from one parent to another. */
export function moveItem(
  groups: ApiGroup[],
  itemId: string,
  targetGroupId: string,
  targetComboId?: string,
  insertAtIndex?: number,
): ApiGroup[] {
  let movedItem: ApiItem | null = null;

  const withoutItem = groups.map((g) => {
    const items = (g.items ?? []).filter((i) => {
      if (i.id === itemId) { movedItem = i; return false; }
      return true;
    });
    const combos = (g.combos ?? []).map((combo) => {
      const cItems = (combo.items ?? []).filter((i) => {
        if (i.id === itemId) { movedItem = i; return false; }
        return true;
      });
      return { ...combo, items: cItems };
    });
    const scopes = (g.scopes ?? []).map((scope) => {
      const sItems = (scope.items ?? []).filter((i) => {
        if (i.id === itemId) { movedItem = i; return false; }
        return true;
      });
      const sCombos = (scope.combos ?? []).map((combo) => {
        const cItems = (combo.items ?? []).filter((i) => {
          if (i.id === itemId) { movedItem = i; return false; }
          return true;
        });
        return { ...combo, items: cItems };
      });
      return { ...scope, items: sItems, combos: sCombos };
    });
    return { ...g, items, combos, scopes };
  });

  if (!movedItem) return groups;

  return withoutItem.map((g) => {
    if (g.id !== targetGroupId) return g;

    if (targetComboId) {
      const combos = (g.combos ?? []).map((combo) => {
        if (combo.id === targetComboId) {
          const items = [...(combo.items ?? [])];
          items.splice(insertAtIndex ?? items.length, 0, movedItem!);
          return { ...combo, items };
        }
        return combo;
      });
      const scopes = (g.scopes ?? []).map((scope) => {
        if (scope.id === targetComboId) {
          const items = [...(scope.items ?? [])];
          items.splice(insertAtIndex ?? items.length, 0, movedItem!);
          return { ...scope, items };
        }
        const sCombos = (scope.combos ?? []).map((combo) => {
          if (combo.id === targetComboId) {
            const items = [...(combo.items ?? [])];
            items.splice(insertAtIndex ?? items.length, 0, movedItem!);
            return { ...combo, items };
          }
          return combo;
        });
        return { ...scope, combos: sCombos };
      });
      return { ...g, combos, scopes };
    }

    const items = [...(g.items ?? [])];
    items.splice(insertAtIndex ?? items.length, 0, movedItem!);
    return { ...g, items };
  });
}

/** Move a combo/scope from one parent group to another. */
export function moveCombo(
  groups: ApiGroup[],
  comboId: string,
  sourceType: 'assembly' | 'scope',
  targetGroupId: string,
  targetComboId?: string,
  insertAtIndex?: number,
): ApiGroup[] {
  let movedCombo: ApiCombo | null = null;
  let movedScope: ApiScope | null = null;

  const withoutCombo = groups.map((g) => {
    if (sourceType === 'scope') {
      const scopes = (g.scopes ?? []).filter((s) => {
        if (s.id === comboId) { movedScope = s; return false; }
        return true;
      });
      return { ...g, scopes };
    }
    const combos = (g.combos ?? []).filter((c) => {
      if (c.id === comboId) { movedCombo = c; return false; }
      return true;
    });
    const scopes = (g.scopes ?? []).map((scope) => {
      const sCombos = (scope.combos ?? []).filter((c) => {
        if (c.id === comboId) { movedCombo = c; return false; }
        return true;
      });
      return { ...scope, combos: sCombos };
    });
    return { ...g, combos, scopes };
  });

  if (!movedCombo && !movedScope) return groups;

  return withoutCombo.map((g) => {
    if (g.id !== targetGroupId) return g;

    if (movedScope) {
      const scopes = [...(g.scopes ?? [])];
      scopes.splice(insertAtIndex ?? scopes.length, 0, movedScope);
      return { ...g, scopes };
    }

    if (targetComboId) {
      const scopes = (g.scopes ?? []).map((scope) => {
        if (scope.id === targetComboId) {
          const combos = [...(scope.combos ?? [])];
          combos.splice(insertAtIndex ?? combos.length, 0, movedCombo!);
          return { ...scope, combos };
        }
        return scope;
      });
      return { ...g, scopes };
    }

    const combos = [...(g.combos ?? [])];
    combos.splice(insertAtIndex ?? combos.length, 0, movedCombo!);
    return { ...g, combos };
  });
}

/** Swap two groups in place (for up/down arrow reorder). */
export function swapGroups(groups: ApiGroup[], groupId: string, direction: 'up' | 'down'): ApiGroup[] {
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return groups;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= groups.length) return groups;
  const result = [...groups];
  [result[idx], result[swapIdx]] = [result[swapIdx], result[idx]];
  return result;
}

// --- Helpers ---

function reorderByIds<T extends { id?: string }>(items: T[], orderedIds: string[]): T[] {
  const lookup = new Map(items.map((item) => [item.id, item]));
  const result: T[] = [];
  for (const id of orderedIds) {
    const item = lookup.get(id);
    if (item) result.push(item);
  }
  for (const item of items) {
    if (!item.id || !orderedIds.includes(item.id)) result.push(item);
  }
  return result;
}

/** Normalize combo/scope structures: split combos tagged as scopes into group.scopes. */
export function normalizeLineItemGroups(groups: ApiGroup[]): ApiGroup[] {
  return groups.map((group) => {
    const existingScopes = [...(group.scopes ?? [])];
    const existingIds = new Set(existingScopes.map((s) => s.id).filter(Boolean) as string[]);
    const topLevelAssemblies: ApiCombo[] = [];
    const nestedAssemblies: ApiCombo[] = [];

    for (const combo of group.combos ?? []) {
      if (comboKindFromRecord(combo) === 'scope') {
        if (combo.id && existingIds.has(combo.id)) continue;
        existingScopes.push({
          id: combo.id,
          name: combo.name,
          component: combo.component,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          index: combo.index,
          quantity: combo.quantity,
          catalogScopeId: combo.catalogComboId,
          lineScopeStatus: combo.lineScopeStatus,
          items: combo.items,
          combos: [],
          subTotal: combo.subTotal,
          totalTax: combo.totalTax,
          total: combo.total,
          allocatedCost: combo.allocatedCost,
          committedCost: combo.committedCost,
        });
        if (combo.id) existingIds.add(combo.id);
        continue;
      }
      if (parentComboIdFromRecord(combo)) {
        nestedAssemblies.push(combo);
      } else {
        topLevelAssemblies.push(combo);
      }
    }

    const scopes = existingScopes.map((scope) => {
      const extras = nestedAssemblies.filter((combo) => parentComboIdFromRecord(combo) === scope.id);
      if (extras.length === 0) return scope;
      const seen = new Set((scope.combos ?? []).map((c) => c.id).filter(Boolean) as string[]);
      const merged = [...(scope.combos ?? [])];
      for (const extra of extras) {
        if (extra.id && seen.has(extra.id)) continue;
        merged.push(extra);
        if (extra.id) seen.add(extra.id);
      }
      return { ...scope, combos: merged };
    });

    const attachedIds = new Set(
      scopes.flatMap((scope) => (scope.combos ?? []).map((c) => c.id).filter(Boolean) as string[]),
    );
    const combos = [
      ...topLevelAssemblies,
      ...nestedAssemblies.filter((combo) => !combo.id || !attachedIds.has(combo.id)),
    ];

    return { ...group, combos, scopes };
  });
}

function comboKindFromRecord(combo: ApiCombo): 'assembly' | 'scope' {
  if (combo.kind === 'scope') return 'scope';
  const payload = combo.comboPayload;
  if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).kind === 'scope') {
    return 'scope';
  }
  return 'assembly';
}

function parentComboIdFromRecord(combo: ApiCombo): string | undefined {
  if (typeof combo.parentComboId === 'string' && combo.parentComboId) return combo.parentComboId;
  const payload = combo.comboPayload;
  if (payload && typeof payload === 'object') {
    const id = (payload as Record<string, unknown>).parentComboId;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}
