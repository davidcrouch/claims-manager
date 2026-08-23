import type { ApiCombo, ApiGroup, ApiItem, ApiScope, RowEntry } from './types';

const UUID_PATTERN = '[0-9a-f-]{36}';
const GROUP_DROP_PREFIX = 'group-drop-';

interface ParsedRowKey {
  type: 'item' | 'assembly' | 'scope';
  id: string;
  groupId: string;
  parentComboId?: string;
}

/**
 * Parse a composite row key into its structural components.
 * Row keys encode the tree path: `{groupId}-scope-{scopeId}-combo-{comboId}-item-{itemId}`
 */
export function parseRowKey(rowKey: string): ParsedRowKey | null {
  const scopeComboItem = rowKey.match(
    new RegExp(`^(${UUID_PATTERN})-scope-(${UUID_PATTERN})-combo-(${UUID_PATTERN})-item-(${UUID_PATTERN})$`),
  );
  if (scopeComboItem) {
    return { type: 'item', id: scopeComboItem[4], groupId: scopeComboItem[1], parentComboId: scopeComboItem[3] };
  }

  const scopeCombo = rowKey.match(
    new RegExp(`^(${UUID_PATTERN})-scope-(${UUID_PATTERN})-combo-(${UUID_PATTERN})$`),
  );
  if (scopeCombo) {
    return { type: 'assembly', id: scopeCombo[3], groupId: scopeCombo[1], parentComboId: scopeCombo[2] };
  }

  const scopeItem = rowKey.match(
    new RegExp(`^(${UUID_PATTERN})-scope-(${UUID_PATTERN})-item-(${UUID_PATTERN})$`),
  );
  if (scopeItem) {
    return { type: 'item', id: scopeItem[3], groupId: scopeItem[1], parentComboId: scopeItem[2] };
  }

  const comboItem = rowKey.match(
    new RegExp(`^(${UUID_PATTERN})-combo-(${UUID_PATTERN})-item-(${UUID_PATTERN})$`),
  );
  if (comboItem) {
    return { type: 'item', id: comboItem[3], groupId: comboItem[1], parentComboId: comboItem[2] };
  }

  const scope = rowKey.match(new RegExp(`^(${UUID_PATTERN})-scope-(${UUID_PATTERN})$`));
  if (scope) {
    return { type: 'scope', id: scope[2], groupId: scope[1] };
  }

  const combo = rowKey.match(new RegExp(`^(${UUID_PATTERN})-combo-(${UUID_PATTERN})$`));
  if (combo) {
    return { type: 'assembly', id: combo[2], groupId: combo[1] };
  }

  const item = rowKey.match(new RegExp(`^(${UUID_PATTERN})-item-(${UUID_PATTERN})$`));
  if (item) {
    return { type: 'item', id: item[2], groupId: item[1] };
  }

  return null;
}

/** Determine the structural context of a target row key for drop validation. */
export function getTargetContext(rowKey: string): 'group' | 'scope' | 'assembly' | 'item' {
  if (rowKey.includes('-scope-') && !rowKey.includes('-combo-') && !rowKey.includes('-item-')) return 'scope';
  if (rowKey.includes('-combo-') && !rowKey.includes('-item-')) return 'assembly';
  if (rowKey.includes('-item-')) return 'item';
  return 'group';
}

/** Get the parent context type from a row key (for items: what container they live in). */
export function getParentContext(rowKey: string): 'group' | 'scope' | 'assembly' {
  if (rowKey.match(new RegExp(`-scope-${UUID_PATTERN}-combo-${UUID_PATTERN}-item-`))) return 'assembly';
  if (rowKey.match(new RegExp(`-combo-${UUID_PATTERN}-item-`))) return 'assembly';
  if (rowKey.match(new RegExp(`-scope-${UUID_PATTERN}-item-${UUID_PATTERN}$`))) return 'scope';
  return 'group';
}

/** Build a droppable id for a group container (empty area / header). */
export function groupDropKey(groupId: string): string {
  return `${GROUP_DROP_PREFIX}${groupId}`;
}

/** Parse a group container droppable id, returning the group id when matched. */
export function parseGroupDropKey(key: string): string | null {
  if (!key.startsWith(GROUP_DROP_PREFIX)) return null;
  const groupId = key.slice(GROUP_DROP_PREFIX.length);
  return groupId.length > 0 ? groupId : null;
}

/** Validate whether a dragged element type can be dropped in a target context. */
export function canDropInTarget(
  sourceType: 'item' | 'assembly' | 'scope',
  targetContext: 'group' | 'scope' | 'assembly',
): boolean {
  if (sourceType === 'scope') return targetContext === 'group';
  if (sourceType === 'assembly') return targetContext === 'group' || targetContext === 'scope';
  return true;
}

/** Build the row key for a group-level item. */
export function itemRowKey(groupId: string, itemId: string): string {
  return `${groupId}-item-${itemId}`;
}

/** Build the row key for a combo (assembly). */
export function comboRowKey(groupId: string, comboId: string): string {
  return `${groupId}-combo-${comboId}`;
}

/** Build the row key for a scope. */
export function scopeRowKey(groupId: string, scopeId: string): string {
  return `${groupId}-scope-${scopeId}`;
}

/** Build the row key for an item inside a combo. */
export function comboItemRowKey(groupId: string, comboId: string, itemId: string): string {
  return `${groupId}-combo-${comboId}-item-${itemId}`;
}

/** Build the row key for an item inside a scope. */
export function scopeItemRowKey(groupId: string, scopeId: string, itemId: string): string {
  return `${groupId}-scope-${scopeId}-item-${itemId}`;
}

/** Build the row key for a combo nested under a scope. */
export function scopeComboRowKey(groupId: string, scopeId: string, comboId: string): string {
  return `${groupId}-scope-${scopeId}-combo-${comboId}`;
}

/** Build the row key for an item inside a scope-nested combo. */
export function scopeComboItemRowKey(groupId: string, scopeId: string, comboId: string, itemId: string): string {
  return `${groupId}-scope-${scopeId}-combo-${comboId}-item-${itemId}`;
}

/**
 * Build a flat index of all row entries from the group tree.
 * Used for keyboard navigation and dirty tracking.
 */
export function buildRowIndex(groups: ApiGroup[]): RowEntry[] {
  const rows: RowEntry[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const gId = g.id ?? `group-${gi}`;

    for (let ii = 0; ii < (g.items ?? []).length; ii++) {
      const item = g.items![ii];
      rows.push({ kind: 'item', key: `${gId}-item-${item.id ?? ii}`, item });
    }

    for (let ci = 0; ci < (g.combos ?? []).length; ci++) {
      const combo = g.combos![ci];
      const cKey = `${gId}-combo-${combo.id ?? ci}`;
      rows.push({ kind: 'assembly', key: cKey, combo });
      for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
        const item = combo.items![ii];
        rows.push({ kind: 'item', key: `${cKey}-item-${item.id ?? ii}`, item });
      }
    }

    for (let si = 0; si < (g.scopes ?? []).length; si++) {
      const scope = g.scopes![si];
      const sKey = `${gId}-scope-${scope.id ?? si}`;
      rows.push({ kind: 'scope', key: sKey, scope });
      for (let ii = 0; ii < (scope.items ?? []).length; ii++) {
        const item = scope.items![ii];
        rows.push({ kind: 'item', key: `${sKey}-item-${item.id ?? ii}`, item });
      }
      for (let ci = 0; ci < (scope.combos ?? []).length; ci++) {
        const combo = scope.combos![ci];
        const cKey = `${sKey}-combo-${combo.id ?? ci}`;
        rows.push({ kind: 'assembly', key: cKey, combo });
        for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
          const item = combo.items![ii];
          rows.push({ kind: 'item', key: `${cKey}-item-${item.id ?? ii}`, item });
        }
      }
    }
  }
  return rows;
}

/** Collect all selectable IDs within a group (used for select-all checkboxes). */
export function collectGroupSelectableIds(group: ApiGroup): string[] {
  const ids: string[] = [];
  for (const item of group.items ?? []) {
    if (item.id) ids.push(item.id);
  }
  for (const combo of group.combos ?? []) {
    if (combo.id) ids.push(combo.id);
    for (const item of combo.items ?? []) {
      if (item.id) ids.push(item.id);
    }
  }
  for (const scope of group.scopes ?? []) {
    if (scope.id) ids.push(scope.id);
    for (const item of scope.items ?? []) {
      if (item.id) ids.push(item.id);
    }
    for (const combo of scope.combos ?? []) {
      if (combo.id) ids.push(combo.id);
      for (const item of combo.items ?? []) {
        if (item.id) ids.push(item.id);
      }
    }
  }
  return ids;
}
