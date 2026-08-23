import { useCallback, useMemo, useRef } from 'react';
import type { ApiGroup, EditableFieldKey, RowEntry } from '../lib/types';
import { buildRowIndex } from '../lib/row-keys';
import { initItemInputs, initComboInputs, initScopeInputs } from '../lib/money';

export type EditInputs = Record<string, Record<EditableFieldKey, string>>;

export interface EditState {
  rowKey: string;
  field: EditableFieldKey;
}

export interface UseLineItemEditReturn {
  editState: EditState | null;
  editInputs: EditInputs;
  selectedRows: Set<string>;
  isDirty: boolean;
  dirtyEdits: Record<string, Record<EditableFieldKey, string>>;
  dirtyRowKeys: Set<string>;
  setEditState: (state: EditState | null) => void;
  setEditInputs: React.Dispatch<React.SetStateAction<EditInputs>>;
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleInputChange: (rowKey: string, field: EditableFieldKey, value: string) => void;
  initRow: (rowKey: string, entry: RowEntry) => void;
  resetEdits: () => void;
  rowIndex: RowEntry[];
}

/**
 * Hook managing inline-edit state for the line items table.
 * Tracks which cell is active, multi-selection, and dirty state.
 */
export function useLineItemEdit(
  groups: ApiGroup[],
  structurallyDirty: boolean,
  setState: {
    editState: EditState | null;
    setEditState: (s: EditState | null) => void;
    editInputs: EditInputs;
    setEditInputs: React.Dispatch<React.SetStateAction<EditInputs>>;
    selectedRows: Set<string>;
    setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  },
): UseLineItemEditReturn {
  const { editState, setEditState, editInputs, setEditInputs, selectedRows, setSelectedRows } = setState;

  const rowIndex = useMemo(() => buildRowIndex(groups), [groups]);

  const handleInputChange = useCallback(
    (rowKey: string, field: EditableFieldKey, value: string) => {
      setEditInputs((prev) => {
        if (selectedRows.size > 1 && selectedRows.has(rowKey)) {
          const next = { ...prev };
          for (const key of selectedRows) {
            if (next[key]) next[key] = { ...next[key], [field]: value };
          }
          return next;
        }
        return { ...prev, [rowKey]: { ...prev[rowKey], [field]: value } };
      });
    },
    [setEditInputs, selectedRows],
  );

  const initRow = useCallback(
    (rowKey: string, entry: RowEntry) => {
      setEditInputs((prev) => {
        if (prev[rowKey]) return prev;
        const inputs =
          entry.kind === 'item'
            ? initItemInputs(entry.item)
            : entry.kind === 'scope'
              ? initScopeInputs(entry.scope)
              : initComboInputs(entry.combo);
        return { ...prev, [rowKey]: inputs };
      });
    },
    [setEditInputs],
  );

  const resetEdits = useCallback(() => {
    setEditInputs({});
    setEditState(null);
    setSelectedRows(new Set());
  }, [setEditInputs, setEditState, setSelectedRows]);

  const isDirty = useMemo(() => {
    if (structurallyDirty) return true;
    const keys = Object.keys(editInputs);
    if (keys.length === 0) return false;
    for (const entry of rowIndex) {
      const inputs = editInputs[entry.key];
      if (!inputs) continue;
      const orig =
        entry.kind === 'item'
          ? initItemInputs(entry.item)
          : entry.kind === 'scope'
            ? initScopeInputs(entry.scope)
            : initComboInputs(entry.combo);
      for (const f of Object.keys(orig) as EditableFieldKey[]) {
        if (inputs[f] !== orig[f]) return true;
      }
    }
    return false;
  }, [editInputs, rowIndex, structurallyDirty]);

  const dirtyEdits = useMemo(() => {
    const result: Record<string, Record<EditableFieldKey, string>> = {};
    for (const entry of rowIndex) {
      const inputs = editInputs[entry.key];
      if (!inputs) continue;
      const orig =
        entry.kind === 'item'
          ? initItemInputs(entry.item)
          : entry.kind === 'scope'
            ? initScopeInputs(entry.scope)
            : initComboInputs(entry.combo);
      let changed = false;
      for (const f of Object.keys(orig) as EditableFieldKey[]) {
        if (inputs[f] !== orig[f]) {
          changed = true;
          break;
        }
      }
      if (changed) result[entry.key] = inputs;
    }
    return result;
  }, [editInputs, rowIndex]);

  const dirtyRowKeys = useMemo(() => new Set(Object.keys(dirtyEdits)), [dirtyEdits]);

  return {
    editState,
    editInputs,
    selectedRows,
    isDirty,
    dirtyEdits,
    dirtyRowKeys,
    setEditState,
    setEditInputs,
    setSelectedRows,
    handleInputChange,
    initRow,
    resetEdits,
    rowIndex,
  };
}

/**
 * Build the "originals" snapshot from current groups for an undo buffer.
 */
export function buildLineItemOriginals(
  groups: ApiGroup[],
  edits: Record<string, Record<string, string>>,
): Record<string, Record<EditableFieldKey, string>> {
  const result: Record<string, Record<EditableFieldKey, string>> = {};
  const keys = Object.keys(edits);
  if (keys.length === 0) return result;

  const rowIndex = buildRowIndex(groups);
  for (const entry of rowIndex) {
    if (!edits[entry.key]) continue;
    result[entry.key] =
      entry.kind === 'item'
        ? initItemInputs(entry.item)
        : entry.kind === 'scope'
          ? initScopeInputs(entry.scope)
          : initComboInputs(entry.combo);
  }
  return result;
}
