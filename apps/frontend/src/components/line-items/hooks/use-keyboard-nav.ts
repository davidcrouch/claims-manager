import { useCallback } from 'react';
import type { EditableFieldKey, RowEntry } from '../lib/types';
import {
  getEditableFields,
  NAME_COL_FIELDS,
  ASSEMBLY_EDITABLE_FIELDS,
  SCOPE_EDITABLE_FIELDS,
  getNameColFields,
  getAssemblyEditableFields,
  getScopeEditableFields,
} from '../lib/money';

/** Walk visible rows until the next entry of `kind` (or any row when omitted). */
function findAdjacentRowIndex(
  rows: RowEntry[],
  startIdx: number,
  direction: -1 | 1,
  kind?: RowEntry['kind'],
): number {
  let idx = startIdx + direction;
  while (idx >= 0 && idx < rows.length) {
    if (!kind || rows[idx].kind === kind) return idx;
    idx += direction;
  }
  return -1;
}

export interface UseKeyboardNavOptions {
  editState: { rowKey: string; field: EditableFieldKey } | null;
  setEditState: (state: { rowKey: string; field: EditableFieldKey } | null) => void;
  visibleRowIndex: RowEntry[];
  showMarkup: boolean;
  showGst: boolean;
  showQuantities: boolean;
  showPricing: boolean;
  hideComponent: boolean;
  invoiceProgressEditable?: boolean;
  selectedRows: Set<string>;
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  initRow: (rowKey: string, entry: RowEntry) => void;
}

/**
 * Hook that handles keyboard navigation within the line items table.
 * Arrow keys move between cells; Tab cycles through fields; Escape/Enter commit.
 */
export function useKeyboardNav({
  editState,
  setEditState,
  visibleRowIndex,
  showMarkup,
  showGst,
  showQuantities,
  showPricing,
  hideComponent,
  invoiceProgressEditable = false,
  selectedRows,
  setSelectedRows,
  initRow,
}: UseKeyboardNavOptions) {
  const navigateToRow = useCallback(
    (rowIdx: number, field: EditableFieldKey) => {
      if (rowIdx < 0 || rowIdx >= visibleRowIndex.length) return;
      const target = visibleRowIndex[rowIdx];
      if (invoiceProgressEditable && target.kind !== 'item') return;

      const assemblyFields = showQuantities
        ? getAssemblyEditableFields(hideComponent)
        : getAssemblyEditableFields(hideComponent).filter((f) => f !== 'quantity');
      const scopeFields = showQuantities
        ? getScopeEditableFields(hideComponent)
        : getScopeEditableFields(hideComponent).filter((f) => f !== 'quantity');

      let effectiveField: EditableFieldKey = invoiceProgressEditable ? 'invoiced' : field;
      if (!invoiceProgressEditable) {
        if (hideComponent && field === 'component') effectiveField = 'name';
        if (target.kind === 'assembly') {
          effectiveField = assemblyFields.includes(effectiveField) ? effectiveField : 'name';
        } else if (target.kind === 'scope') {
          effectiveField = scopeFields.includes(effectiveField) ? effectiveField : 'name';
        }
      }

      initRow(target.key, target);
      setEditState({ rowKey: target.key, field: effectiveField });
    },
    [visibleRowIndex, showQuantities, hideComponent, invoiceProgressEditable, initRow, setEditState],
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editState) return;

      const currentRow = visibleRowIndex.find((r) => r.key === editState.rowKey);
      const nameColFields = getNameColFields(hideComponent);
      const assemblyFields = showQuantities
        ? getAssemblyEditableFields(hideComponent)
        : getAssemblyEditableFields(hideComponent).filter((f) => f !== 'quantity');
      const scopeFields = showQuantities
        ? getScopeEditableFields(hideComponent)
        : getScopeEditableFields(hideComponent).filter((f) => f !== 'quantity');
      const fields =
        currentRow?.kind === 'assembly'
          ? assemblyFields
          : currentRow?.kind === 'scope'
            ? scopeFields
            : getEditableFields(
                showMarkup,
                showGst,
                showQuantities,
                showPricing,
                hideComponent,
                invoiceProgressEditable,
              );

      const colIdx = fields.indexOf(editState.field);
      const inNameCol = nameColFields.includes(editState.field);

      switch (e.key) {
        case 'ArrowLeft':
          if (invoiceProgressEditable) break;
          e.preventDefault();
          if (!hideComponent && editState.field === 'component') {
            setEditState({ ...editState, field: 'name' });
          } else if (editState.field === 'description') {
            setEditState({ ...editState, field: hideComponent ? 'name' : 'component' });
          } else if (!inNameCol && colIdx > 0) {
            const prev = fields[colIdx - 1];
            setEditState({ ...editState, field: prev === 'description' ? (hideComponent ? 'name' : 'component') : prev });
          }
          break;

        case 'ArrowRight':
          if (invoiceProgressEditable) break;
          e.preventDefault();
          if (editState.field === 'name') {
            setEditState({ ...editState, field: hideComponent ? 'description' : 'component' });
          } else if (!hideComponent && (editState.field === 'component' || editState.field === 'description')) {
            const nextField = fields.find((f) => !nameColFields.includes(f));
            if (nextField) setEditState({ ...editState, field: nextField });
          } else if (hideComponent && editState.field === 'description') {
            const nextField = fields.find((f) => !nameColFields.includes(f));
            if (nextField) setEditState({ ...editState, field: nextField });
          } else if (colIdx < fields.length - 1) {
            setEditState({ ...editState, field: fields[colIdx + 1] });
          }
          break;

        case 'ArrowUp': {
          e.preventDefault();
          if (selectedRows.size > 1) break;
          const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
          if (rowIdx < 0) break;

          if (invoiceProgressEditable) {
            const prevIdx = findAdjacentRowIndex(visibleRowIndex, rowIdx, -1, 'item');
            if (prevIdx >= 0) navigateToRow(prevIdx, 'invoiced');
            break;
          }

          if (currentRow?.kind === 'item' && nameColFields.includes(editState.field)) {
            const prevIdx = findAdjacentRowIndex(visibleRowIndex, rowIdx, -1, 'item');
            if (prevIdx >= 0) navigateToRow(prevIdx, editState.field);
            break;
          }

          if (editState.field === 'description') {
            setEditState({ ...editState, field: 'name' });
          } else if (editState.field === 'name' || (!hideComponent && editState.field === 'component')) {
            if (rowIdx > 0) navigateToRow(rowIdx - 1, 'description');
          } else if (rowIdx > 0) {
            navigateToRow(rowIdx - 1, editState.field);
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          if (selectedRows.size > 1) break;
          const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
          if (rowIdx < 0) break;

          if (invoiceProgressEditable) {
            const nextIdx = findAdjacentRowIndex(visibleRowIndex, rowIdx, 1, 'item');
            if (nextIdx >= 0) navigateToRow(nextIdx, 'invoiced');
            break;
          }

          if (currentRow?.kind === 'item' && nameColFields.includes(editState.field)) {
            const nextIdx = findAdjacentRowIndex(visibleRowIndex, rowIdx, 1, 'item');
            if (nextIdx >= 0) navigateToRow(nextIdx, editState.field);
            break;
          }

          if (editState.field === 'name' || (!hideComponent && editState.field === 'component')) {
            setEditState({ ...editState, field: 'description' });
          } else if (editState.field === 'description') {
            if (rowIdx < visibleRowIndex.length - 1) navigateToRow(rowIdx + 1, 'name');
          } else if (rowIdx < visibleRowIndex.length - 1) {
            navigateToRow(rowIdx + 1, editState.field);
          }
          break;
        }

        case 'Tab': {
          e.preventDefault();
          if (invoiceProgressEditable) {
            const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
            if (rowIdx < 0) break;
            if (e.shiftKey) {
              const prevIdx = findAdjacentRowIndex(visibleRowIndex, rowIdx, -1, 'item');
              if (prevIdx >= 0) navigateToRow(prevIdx, 'invoiced');
            } else {
              const nextIdx = findAdjacentRowIndex(visibleRowIndex, rowIdx, 1, 'item');
              if (nextIdx >= 0) navigateToRow(nextIdx, 'invoiced');
            }
            break;
          }
          if (e.shiftKey) {
            if (editState.field === 'description') {
              setEditState({ ...editState, field: hideComponent ? 'name' : 'component' });
            } else if (!hideComponent && editState.field === 'component') {
              setEditState({ ...editState, field: 'name' });
            } else if (!inNameCol && colIdx > 0) {
              const prev = fields[colIdx - 1];
              setEditState({ ...editState, field: prev === 'description' ? 'description' : prev });
            } else if (inNameCol && editState.field === 'name') {
              const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
              if (rowIdx > 0) {
                const prevRow = visibleRowIndex[rowIdx - 1];
                const prevFields =
                  prevRow.kind === 'assembly'
                    ? assemblyFields
                    : prevRow.kind === 'scope'
                      ? scopeFields
                      : fields;
                navigateToRow(rowIdx - 1, prevFields[prevFields.length - 1]);
              }
            }
          } else {
            if (editState.field === 'name') {
              setEditState({ ...editState, field: hideComponent ? 'description' : 'component' });
            } else if (!hideComponent && editState.field === 'component') {
              setEditState({ ...editState, field: 'description' });
            } else if (colIdx < fields.length - 1) {
              setEditState({ ...editState, field: fields[colIdx + 1] });
            } else {
              const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
              if (rowIdx >= 0 && rowIdx < visibleRowIndex.length - 1) {
                navigateToRow(rowIdx + 1, 'name');
              }
            }
          }
          break;
        }

        case 'Escape':
        case 'Enter':
          e.preventDefault();
          setEditState(null);
          setSelectedRows(new Set());
          break;
      }
    },
    [editState, setEditState, visibleRowIndex, showMarkup, showGst, showQuantities, showPricing, hideComponent, invoiceProgressEditable, selectedRows, setSelectedRows, navigateToRow],
  );

  return { handleCellKeyDown, navigateToRow };
}
