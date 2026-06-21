'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  GripVertical,
  Layers,
  Package,
  MoreVertical,
  Pencil,
  Save,
  Search,
  Square,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/components/shared/detail';
import {
  getCatalogDragData,
  getGroupLabelDragData,
  hasGroupLabelDrag,
  type CatalogDragPayload,
  type GroupLabelDragPayload,
} from '@/components/catalog/catalog-drag';
import type { ApiCombo, ApiGroup, ApiItem } from '@/components/quotes/quote-line-items.types';
import { groupLabel } from '@/components/quotes/quote-line-items.utils';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function lookupDisplay(l?: { name?: string; externalReference?: string }): string {
  if (!l) return '—';
  return l.name ?? l.externalReference ?? '—';
}

/* ---- Inline-edit types & helpers ---- */

type EditableFieldKey = 'name' | 'component' | 'description' | 'quantity' | 'unitCost' | 'markupValue' | 'tax';
type ColumnKey = 'name' | 'type' | 'category' | 'quantity' | 'unitCost' | 'extended' | 'markupValue' | 'tax' | 'total';

function getEditableFields(showMarkup: boolean, showGst: boolean): EditableFieldKey[] {
  const fields: EditableFieldKey[] = ['name', 'component', 'description', 'quantity', 'unitCost'];
  if (showMarkup) fields.push('markupValue');
  if (showGst) fields.push('tax');
  return fields;
}

const NAME_COL_FIELDS: EditableFieldKey[] = ['name', 'component', 'description'];

function nearestEditableField(
  clicked: ColumnKey,
  showMarkup: boolean,
  showGst: boolean,
): EditableFieldKey {
  const editableFields = getEditableFields(showMarkup, showGst);
  if ((editableFields as string[]).includes(clicked)) return clicked as EditableFieldKey;

  const allCols: ColumnKey[] = ['name', 'type', 'category', 'quantity', 'unitCost', 'extended'];
  if (showMarkup) allCols.push('markupValue');
  if (showGst) allCols.push('tax');
  allCols.push('total');

  const idx = allCols.indexOf(clicked);
  for (let dist = 1; dist < allCols.length; dist++) {
    const left = idx - dist;
    if (left >= 0 && (editableFields as string[]).includes(allCols[left])) {
      return allCols[left] as EditableFieldKey;
    }
    const right = idx + dist;
    if (right < allCols.length && (editableFields as string[]).includes(allCols[right])) {
      return allCols[right] as EditableFieldKey;
    }
  }
  return editableFields[0];
}


type RowEntry =
  | { kind: 'item'; key: string; item: ApiItem }
  | { kind: 'assembly'; key: string; combo: ApiCombo };

const ASSEMBLY_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];

function initItemInputs(item: ApiItem): Record<EditableFieldKey, string> {
  return {
    name: item.name ?? '',
    component: item.component ?? '',
    description: item.description ?? '',
    quantity: String(item.quantity ?? 0),
    unitCost: String(item.unitCost ?? 0),
    markupValue: String(item.markupValue ?? 19),
    tax: typeof item.tax === 'number' ? String(+(item.tax * 100).toFixed(2)) : '0',
  };
}

function initComboInputs(combo: ApiCombo): Record<EditableFieldKey, string> {
  return {
    name: combo.name ?? '',
    component: combo.component ?? '',
    description: combo.description ?? '',
    quantity: String(combo.quantity ?? 0),
    unitCost: '0',
    markupValue: '0',
    tax: '0',
  };
}

/* ---- Sub-components ---- */

function ItemRow({
  item,
  rowKey,
  indented,
  showMarkup,
  showGst,
  isEditing,
  selectedField,
  editInputs,
  onRowClick,
  onCellSelect,
  onInputChange,
  onCellKeyDown,
  onDelete,
  isPrimaryEdit,
  isMultiSelected,
  isDirtyRow,
}: {
  item: ApiItem;
  rowKey: string;
  indented?: boolean;
  showMarkup: boolean;
  showGst: boolean;
  isEditing: boolean;
  selectedField: EditableFieldKey | null;
  editInputs: Record<EditableFieldKey, string> | null;
  onRowClick: (e: React.MouseEvent, rowKey: string, item: ApiItem) => void;
  onCellSelect: (rowKey: string, field: EditableFieldKey) => void;
  onInputChange: (rowKey: string, field: EditableFieldKey, value: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onDelete?: (request: DeleteItemRequest) => void;
  isPrimaryEdit?: boolean;
  isMultiSelected?: boolean;
  isDirtyRow?: boolean;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mismatches = item.mismatches ?? [];

  const qty = editInputs ? parseFloat(editInputs.quantity) || 0 : (item.quantity ?? 0);
  const unitCost = editInputs ? parseFloat(editInputs.unitCost) || 0 : (item.unitCost ?? 0);
  const mkVal = editInputs ? parseFloat(editInputs.markupValue) || 0 : (item.markupValue ?? 19);
  const taxPct = editInputs ? parseFloat(editInputs.tax) || 0 : (typeof item.tax === 'number' ? +(item.tax * 100).toFixed(2) : 0);

  const extended = qty * unitCost;
  const markupAmt = item.markupType === 'fixed' ? mkVal * qty : extended * (mkVal / 100);
  const sub = extended + markupAmt;
  const total = sub + sub * (taxPct / 100);

  useEffect(() => {
    if (isEditing && selectedField && isPrimaryEdit !== false) {
      const el = inputRefs.current[selectedField];
      if (el) { el.focus(); el.select(); }
    }
  }, [isEditing, selectedField, isPrimaryEdit]);

  const editCellCls = (field: EditableFieldKey) =>
    isEditing
      ? cn(
          'whitespace-nowrap p-0 transition-shadow',
          selectedField === field
            ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
            : isMultiSelected
              ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
              : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40',
        )
      : 'whitespace-nowrap px-4 py-2.5 hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]';

  const nameColTdCls = isEditing
    ? cn(
        'p-0 transition-shadow',
        isMultiSelected
          ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
          : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40',
      )
    : 'px-4 py-2.5 hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]';

  const subCellCls = (field: EditableFieldKey) =>
    cn(
      'transition-shadow rounded-sm',
      selectedField === field
        ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
        : '',
    );

  const roCellCls = cn('whitespace-nowrap px-4 py-2.5', isEditing && (isMultiSelected ? 'bg-blue-50/30' : 'bg-amber-50/40'));

  const inputCls = (align: 'left' | 'right' = 'right') =>
    cn('w-full bg-transparent px-4 py-2.5 outline-none', align === 'right' ? 'text-right font-mono text-slate-700' : 'font-medium text-slate-900');

  const cellClick = (field: EditableFieldKey) => (e: React.MouseEvent) => {
    if (isEditing) { e.stopPropagation(); onCellSelect(rowKey, field); }
  };

  return (
    <tr
      data-item-row
      className={cn(
        'cursor-pointer transition-colors',
        isEditing
          ? isMultiSelected
            ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
            : 'ring-2 ring-inset ring-amber-300 bg-amber-50/40'
          : isDirtyRow
            ? 'bg-emerald-100 hover:bg-emerald-200 hover:ring-2 hover:ring-inset hover:ring-emerald-400'
            : 'hover:bg-amber-50/40 hover:ring-2 hover:ring-inset hover:ring-amber-300',
      )}
      onClick={(e) => onRowClick(e, rowKey, item)}
    >
      {/* Name / Component / Description (editable as separate cells) */}
      <td data-col="name" className={cn(nameColTdCls, 'min-w-0')} onClick={cellClick('name')}>
        {isEditing && editInputs ? (
          <div className={cn(indented && 'pl-7')}>
            {/* Top row: Name + Component side by side */}
            <div className="flex">
              <div
                className={cn('flex-1 min-w-0', subCellCls('name'))}
                onClick={(e) => { e.stopPropagation(); onCellSelect(rowKey, 'name'); }}
              >
                <input
                  ref={(el) => { inputRefs.current.name = el; }}
                  value={editInputs.name}
                  onChange={(e) => onInputChange(rowKey, 'name', e.target.value)}
                  onKeyDown={onCellKeyDown}
                  onFocus={() => onCellSelect(rowKey, 'name')}
                  placeholder="Name…"
                  className={cn(inputCls('left'), 'truncate')}
                />
              </div>
              <div
                className={cn('flex-1 min-w-0 border-l border-slate-200', subCellCls('component'))}
                onClick={(e) => { e.stopPropagation(); onCellSelect(rowKey, 'component'); }}
              >
                <input
                  ref={(el) => { inputRefs.current.component = el; }}
                  value={editInputs.component}
                  onChange={(e) => onInputChange(rowKey, 'component', e.target.value)}
                  onKeyDown={onCellKeyDown}
                  onFocus={() => onCellSelect(rowKey, 'component')}
                  placeholder="Component…"
                  className={cn(inputCls('left'), 'truncate text-slate-600 !font-normal')}
                />
              </div>
            </div>
            {/* Bottom row: Description full width */}
            <div
              className={cn('border-t border-slate-100', subCellCls('description'))}
              onClick={(e) => { e.stopPropagation(); onCellSelect(rowKey, 'description'); }}
            >
              <input
                ref={(el) => { inputRefs.current.description = el; }}
                value={editInputs.description}
                onChange={(e) => onInputChange(rowKey, 'description', e.target.value)}
                onKeyDown={onCellKeyDown}
                onFocus={() => onCellSelect(rowKey, 'description')}
                placeholder="Description…"
                className="w-full bg-transparent px-4 py-1.5 text-xs text-slate-500 outline-none placeholder:text-slate-300"
              />
            </div>
          </div>
        ) : (
          <>
            <div className={cn('truncate font-medium text-slate-900', indented && 'pl-7')}>
              {(editInputs?.name ?? item.name) || '—'}
              {(editInputs?.component ?? item.component) && (
                <span className="font-normal text-slate-600">
                  {' - '}{editInputs?.component ?? item.component}
                </span>
              )}
              {item.internal && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                  internal
                </span>
              )}
            </div>
            {(item.description || editInputs?.description) && (
              <p className={cn('mt-0.5 line-clamp-1 text-xs text-slate-500', indented && 'pl-7')}>
                {editInputs?.description ?? item.description}
              </p>
            )}
            {mismatches.length > 0 && (
              <span className={cn(
                'mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700',
                indented && 'ml-7',
              )}>
                <AlertTriangle className="h-3 w-3" />
                Catalogue mismatch
              </span>
            )}
          </>
        )}
      </td>

      {/* Type (read-only) */}
      <td data-col="type" className={cn(roCellCls, 'text-slate-600')}>{item.type ?? '—'}</td>

      {/* Category (read-only) */}
      <td data-col="category" className={cn(roCellCls, 'truncate text-slate-600')}>
        {[item.category, item.subCategory].filter(Boolean).join(' / ') || '—'}
      </td>

      {/* Qty (editable) */}
      <td data-col="quantity" className={cn(editCellCls('quantity'), 'text-right')} onClick={cellClick('quantity')}>
        {isEditing && editInputs ? (
          <input
            ref={(el) => { inputRefs.current.quantity = el; }}
            value={editInputs.quantity}
            onChange={(e) => onInputChange(rowKey, 'quantity', e.target.value)}
            onKeyDown={onCellKeyDown}
            className={inputCls('right')}
          />
        ) : (
          <span className="font-mono text-slate-700">
            {qty}
            {item.unitType && <span className="ml-1 text-xs text-slate-400">{lookupDisplay(item.unitType)}</span>}
          </span>
        )}
      </td>

      {/* Unit Cost (editable) */}
      <td data-col="unitCost" className={cn(editCellCls('unitCost'), 'text-right')} onClick={cellClick('unitCost')}>
        {isEditing && editInputs ? (
          <input
            ref={(el) => { inputRefs.current.unitCost = el; }}
            value={editInputs.unitCost}
            onChange={(e) => onInputChange(rowKey, 'unitCost', e.target.value)}
            onKeyDown={onCellKeyDown}
            className={inputCls('right')}
          />
        ) : (
          <span className="font-mono text-slate-700">{formatCurrency(unitCost)}</span>
        )}
      </td>

      {/* Extended (computed) */}
      <td data-col="extended" className={cn(roCellCls, 'text-right font-mono text-slate-700')}>
        {formatCurrency(extended)}
      </td>

      {/* Markup (editable, conditional) */}
      {showMarkup && (
        <td data-col="markupValue" className={cn(editCellCls('markupValue'), 'text-right')} onClick={cellClick('markupValue')}>
          {isEditing && editInputs ? (
            <input
              ref={(el) => { inputRefs.current.markupValue = el; }}
              value={editInputs.markupValue}
              onChange={(e) => onInputChange(rowKey, 'markupValue', e.target.value)}
              onKeyDown={onCellKeyDown}
              className={inputCls('right')}
            />
          ) : (
            <span className="font-mono text-slate-700">
              {item.markupType === 'fixed' ? formatCurrency(mkVal) : `${mkVal}%`}
            </span>
          )}
        </td>
      )}

      {/* GST (editable, conditional) */}
      {showGst && (
        <td data-col="tax" className={cn(editCellCls('tax'), 'text-right')} onClick={cellClick('tax')}>
          {isEditing && editInputs ? (
            <input
              ref={(el) => { inputRefs.current.tax = el; }}
              value={editInputs.tax}
              onChange={(e) => onInputChange(rowKey, 'tax', e.target.value)}
              onKeyDown={onCellKeyDown}
              className={inputCls('right')}
            />
          ) : (
            <span className="font-mono text-slate-700">
              {taxPct ? `${taxPct}%` : '—'}
            </span>
          )}
        </td>
      )}

      {/* Total (computed) */}
      <td data-col="total" className={cn(roCellCls, 'text-right font-medium text-slate-900')}>
        {formatCurrency(editInputs ? total : item.total)}
      </td>

      {/* Actions */}
      <td className="w-10 px-1 py-2.5 text-center">
        {onDelete && item.id && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete({ itemId: item.id!, itemName: item.name, isAssemblyChild: !!indented })}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </tr>
  );
}

function AssemblyBlock({
  combo,
  comboKey,
  comboItems,
  comboItemCount,
  isCollapsed,
  onToggle,
  showMarkup,
  showGst,
  editState,
  editInputs,
  selectedRows,
  dirtyRowKeys,
  onItemClick,
  onAssemblyClick,
  onCellSelect,
  onInputChange,
  onCellKeyDown,
  onDeleteCombo,
  onDeleteItem,
}: {
  combo: ApiCombo;
  comboKey: string;
  comboItems: ApiItem[];
  comboItemCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  showMarkup: boolean;
  showGst: boolean;
  editState: { rowKey: string; field: EditableFieldKey } | null;
  editInputs: Record<string, Record<EditableFieldKey, string>>;
  selectedRows: Set<string>;
  dirtyRowKeys: Set<string>;
  onItemClick: (e: React.MouseEvent, rowKey: string, item: ApiItem) => void;
  onAssemblyClick: (e: React.MouseEvent, rowKey: string, combo: ApiCombo) => void;
  onCellSelect: (rowKey: string, field: EditableFieldKey) => void;
  onInputChange: (rowKey: string, field: EditableFieldKey, value: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onDeleteCombo?: (comboId: string) => void;
  onDeleteItem?: (request: DeleteItemRequest) => void;
}) {
  const comboName = combo.name ?? 'Assembly';
  const comboCategory =
    [combo.category, combo.subCategory].filter(Boolean).join(' / ') || '—';
  const isEditing = editState?.rowKey === comboKey || (selectedRows.has(comboKey) && editState !== null);
  const comboInputs = editInputs[comboKey] ?? null;
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const componentInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const isPrimary = editState?.rowKey === comboKey;
  const isComboMultiSelected = selectedRows.size > 1 && selectedRows.has(comboKey);
  const comboBg = isComboMultiSelected ? 'bg-blue-50/30' : 'bg-amber-50/40';
  const comboRing = isComboMultiSelected
    ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
    : 'ring-2 ring-inset ring-amber-300 bg-amber-50/40';

  useEffect(() => {
    if (isEditing && isPrimary) {
      if (editState?.field === 'name') {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      } else if (editState?.field === 'component') {
        componentInputRef.current?.focus();
        componentInputRef.current?.select();
      } else if (editState?.field === 'description') {
        descriptionInputRef.current?.focus();
        descriptionInputRef.current?.select();
      } else if (editState?.field === 'quantity') {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }
    }
  }, [isEditing, isPrimary, editState?.field]);

  return (
    <>
      {/* Assembly header row */}
      <tr
        data-item-row
        className={cn(
          'cursor-pointer transition-colors',
          isEditing
            ? comboRing
            : dirtyRowKeys.has(comboKey)
              ? 'bg-emerald-200 hover:bg-emerald-300'
              : 'bg-slate-200 hover:bg-slate-300',
        )}
        onClick={(e) => {
          if (isEditing) {
            onToggle();
            return;
          }
          const target = e.target as HTMLElement;
          const fieldArea = target.closest('[data-assembly-field]');
          if (fieldArea) {
            onAssemblyClick(e, comboKey, combo);
            if (isCollapsed) onToggle();
          } else {
            onToggle();
          }
        }}
      >
        <td
          className={cn(
            'p-0',
            isEditing
              ? isComboMultiSelected
                ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
                : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40'
              : 'px-4 py-2.5 hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]',
          )}
          colSpan={1}
        >
          {isEditing && comboInputs ? (
            <div className="pl-2">
              {/* Top row: Name + Component + item count */}
              <div className="flex items-center">
                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                  )}
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div
                  className={cn(
                    'flex-1 min-w-0 rounded-sm transition-shadow',
                    editState?.field === 'name'
                      ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                      : '',
                  )}
                  onClick={(e) => { e.stopPropagation(); onCellSelect(comboKey, 'name'); }}
                >
                  <input
                    ref={nameInputRef}
                    value={comboInputs.name}
                    onChange={(e) => onInputChange(comboKey, 'name', e.target.value)}
                    onKeyDown={onCellKeyDown}
                    onFocus={() => onCellSelect(comboKey, 'name')}
                    placeholder="Name…"
                    className="w-full bg-transparent px-4 py-2 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300 truncate"
                  />
                </div>
                <div
                  className={cn(
                    'flex-1 min-w-0 border-l border-slate-200 rounded-sm transition-shadow',
                    editState?.field === 'component'
                      ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                      : '',
                  )}
                  onClick={(e) => { e.stopPropagation(); onCellSelect(comboKey, 'component'); }}
                >
                  <input
                    ref={componentInputRef}
                    value={comboInputs.component}
                    onChange={(e) => onInputChange(comboKey, 'component', e.target.value)}
                    onKeyDown={onCellKeyDown}
                    onFocus={() => onCellSelect(comboKey, 'component')}
                    placeholder="Component…"
                    className="w-full bg-transparent px-4 py-2 text-sm text-slate-600 outline-none placeholder:text-slate-300 truncate"
                  />
                </div>
              </div>
              {/* Bottom row: Description full width */}
              <div
                className={cn(
                  'border-t border-slate-100 rounded-sm transition-shadow',
                  editState?.field === 'description'
                    ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                    : '',
                )}
                onClick={(e) => { e.stopPropagation(); onCellSelect(comboKey, 'description'); }}
              >
                <input
                  ref={descriptionInputRef}
                  value={comboInputs.description}
                  onChange={(e) => onInputChange(comboKey, 'description', e.target.value)}
                  onKeyDown={onCellKeyDown}
                  onFocus={() => onCellSelect(comboKey, 'description')}
                  placeholder="Description…"
                  className="w-full bg-transparent px-4 py-1.5 text-xs text-slate-500 outline-none placeholder:text-slate-300"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
              )}
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              <div
                className="flex-1 min-w-0"
                data-assembly-field="name"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">
                    {comboName}
                    {(comboInputs?.component ?? combo.component) && (
                      <span className="font-normal text-slate-600">
                        {' - '}{comboInputs?.component ?? combo.component}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                    {comboItemCount} item{comboItemCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {(combo.description || comboInputs?.description) && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {comboInputs?.description ?? combo.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </td>
        <td className={cn('px-4 py-2.5 text-xs text-slate-600', isEditing && comboBg)}>Assembly</td>
        <td className={cn('px-4 py-2.5 text-xs text-slate-600', isEditing && comboBg)}>{comboCategory}</td>
        <td
          data-col="quantity"
          data-assembly-field="quantity"
          className={cn(
            'whitespace-nowrap text-right',
            isEditing
              ? cn(
                  'p-0 transition-shadow',
                  editState?.field === 'quantity'
                    ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                    : isComboMultiSelected
                      ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
                      : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40',
                )
              : 'px-4 py-2.5 hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]',
          )}
          onClick={isEditing ? (e) => { e.stopPropagation(); onCellSelect(comboKey, 'quantity'); } : undefined}
        >
          {isEditing && comboInputs ? (
            <input
              ref={qtyInputRef}
              value={comboInputs.quantity}
              onChange={(e) => onInputChange(comboKey, 'quantity', e.target.value)}
              onKeyDown={onCellKeyDown}
              className="w-full bg-transparent px-4 py-2.5 text-right font-mono text-slate-700 outline-none"
            />
          ) : (
            <span className="font-mono text-slate-700">{combo.quantity ?? '—'}</span>
          )}
        </td>
        <td className={cn('px-4 py-2.5', isEditing && comboBg)} />
        <td className={cn('px-4 py-2.5', isEditing && comboBg)} />
        {showMarkup && <td className={cn('px-4 py-2.5', isEditing && comboBg)} />}
        {showGst && <td className={cn('px-4 py-2.5', isEditing && comboBg)} />}
        <td className={cn('whitespace-nowrap px-4 py-2.5 text-right font-semibold text-slate-900', isEditing && comboBg)}>
          {formatCurrency(combo.total)}
        </td>

        {/* Actions */}
        <td className="w-10 px-1 py-2.5 text-center">
          {onDeleteCombo && combo.id && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDeleteCombo(combo.id!)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </td>
      </tr>

      {/* Assembly child items */}
      {!isCollapsed &&
        comboItems.map((item, idx) => {
          const itemKey = `${comboKey}-item-${item.id ?? idx}`;
          const itemEditing = editState?.rowKey === itemKey || (selectedRows.has(itemKey) && editState !== null);
          const itemPrimary = editState?.rowKey === itemKey;
          return (
            <ItemRow
              key={itemKey}
              item={item}
              rowKey={itemKey}
              indented
              showMarkup={showMarkup}
              showGst={showGst}
              isEditing={itemEditing}
              selectedField={itemEditing ? (editState?.field ?? null) : null}
              editInputs={editInputs[itemKey] ?? null}
              isPrimaryEdit={itemPrimary}
              isMultiSelected={selectedRows.size > 1 && selectedRows.has(itemKey)}
              isDirtyRow={dirtyRowKeys.has(itemKey)}
              onRowClick={onItemClick}
              onCellSelect={onCellSelect}
              onInputChange={onInputChange}
              onCellKeyDown={onCellKeyDown}
              onDelete={onDeleteItem}
            />
          );
        })}
    </>
  );
}

export interface DeleteItemRequest {
  itemId: string;
  itemName?: string;
  isAssemblyChild: boolean;
}

export interface QuoteLineItemsTableProps {
  groups: ApiGroup[];
  activeDropKey: string | null;
  setActiveDropKey: (key: string | null) => void;
  onCatalogDrop: (payload: CatalogDragPayload, groupId?: string) => void;
  onGroupLabelDrop?: (payload: GroupLabelDragPayload) => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onDeleteItem?: (request: DeleteItemRequest) => void;
  onDeleteCombo?: (comboId: string) => void;
  onMoveGroupUp?: (groupId: string) => void;
  onMoveGroupDown?: (groupId: string) => void;
  onOpenCatalogDrawer?: () => void;
  onSave?: (edits: Record<string, Record<EditableFieldKey, string>>) => void;
  structurallyDirty?: boolean;
}

export function QuoteLineItemsTable({
  groups,
  activeDropKey,
  setActiveDropKey,
  onCatalogDrop,
  onGroupLabelDrop,
  onEditGroup,
  onDeleteGroup,
  onDeleteItem,
  onDeleteCombo,
  onMoveGroupUp,
  onMoveGroupDown,
  onOpenCatalogDrawer,
  onSave,
  structurallyDirty,
}: QuoteLineItemsTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedCombos, setCollapsedCombos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showMarkup, setShowMarkup] = useState(true);
  const [showGst, setShowGst] = useState(true);
  const [suppressMarkupIcon, setSuppressMarkupIcon] = useState(false);
  const [suppressGstIcon, setSuppressGstIcon] = useState(false);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [groupFilterOpen, setGroupFilterOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Inline edit state
  const [editState, setEditState] = useState<{ rowKey: string; field: EditableFieldKey } | null>(null);
  const [editInputs, setEditInputs] = useState<Record<string, Record<EditableFieldKey, string>>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEditInputs({});
    setEditState(null);
    setSelectedRows(new Set());
  }, [groups]);

  const toggleCollapse = (groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleCombo = (comboKey: string) => {
    setCollapsedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(comboKey)) next.delete(comboKey);
      else next.add(comboKey);
      return next;
    });
  };

  const allCollapsed = useMemo(() => {
    if (groups.length === 0) return false;
    return groups.every((g, i) => collapsed.has(g.id ?? `group-${i}`));
  }, [groups, collapsed]);

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed(new Set());
      setCollapsedCombos(new Set());
    } else {
      const allGroupIds = groups.map((g, i) => g.id ?? `group-${i}`);
      setCollapsed(new Set(allGroupIds));
      const allComboKeys = groups.flatMap((g, gi) =>
        (g.combos ?? []).map((c, ci) => `${g.id ?? `group-${gi}`}-combo-${c.id ?? ci}`),
      );
      setCollapsedCombos(new Set(allComboKeys));
    }
  };

  const totalItems = useMemo(
    () =>
      groups.reduce(
        (sum, g) =>
          sum +
          (g.items?.length ?? 0) +
          (g.combos ?? []).reduce((cs, c) => cs + (c.items?.length ?? 0), 0),
        0,
      ),
    [groups],
  );

  const itemRowIndex = useMemo(() => {
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
        const comboKey = `${gId}-combo-${combo.id ?? ci}`;
        rows.push({ kind: 'assembly', key: comboKey, combo });
        for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
          const item = combo.items![ii];
          rows.push({ kind: 'item', key: `${comboKey}-item-${item.id ?? ii}`, item });
        }
      }
    }
    return rows;
  }, [groups]);

  const isDirty = useMemo(() => {
    if (structurallyDirty) return true;
    const keys = Object.keys(editInputs);
    if (keys.length === 0) return false;
    for (const entry of itemRowIndex) {
      const inputs = editInputs[entry.key];
      if (!inputs) continue;
      if (entry.kind === 'item') {
        const orig = initItemInputs(entry.item);
        for (const f of Object.keys(orig) as EditableFieldKey[]) {
          if (inputs[f] !== orig[f]) return true;
        }
      } else {
        const orig = initComboInputs(entry.combo);
        if (inputs.quantity !== orig.quantity) return true;
      }
    }
    return false;
  }, [editInputs, itemRowIndex, structurallyDirty]);

  const dirtyEdits = useMemo(() => {
    const result: Record<string, Record<EditableFieldKey, string>> = {};
    for (const entry of itemRowIndex) {
      const inputs = editInputs[entry.key];
      if (!inputs) continue;
      const orig = entry.kind === 'item' ? initItemInputs(entry.item) : initComboInputs(entry.combo);
      let changed = false;
      for (const f of Object.keys(orig) as EditableFieldKey[]) {
        if (inputs[f] !== orig[f]) { changed = true; break; }
      }
      if (changed) result[entry.key] = inputs;
    }
    return result;
  }, [editInputs, itemRowIndex]);

  const dirtyRowKeys = useMemo(() => new Set(Object.keys(dirtyEdits)), [dirtyEdits]);

  const grandTotals = useMemo(() => {
    let subTotal = 0;
    let markup = 0;
    let totalTax = 0;
    let total = 0;

    function addItemMarkup(item: ApiItem) {
      const cost = (item.unitCost ?? 0) * (item.quantity ?? 0);
      if (item.markupType === 'fixed') {
        markup += (item.markupValue ?? 0) * (item.quantity ?? 0);
      } else {
        const pct = item.markupValue ?? 19;
        markup += cost * (pct / 100);
      }
    }

    for (const g of groups) {
      for (const item of g.items ?? []) {
        subTotal += item.subTotal ?? 0;
        totalTax += item.totalTax ?? 0;
        total += item.total ?? 0;
        addItemMarkup(item);
      }
      for (const combo of g.combos ?? []) {
        subTotal += combo.subTotal ?? 0;
        totalTax += combo.totalTax ?? 0;
        total += combo.total ?? 0;
        for (const item of combo.items ?? []) {
          addItemMarkup(item);
        }
      }
    }
    return { subTotal: subTotal - markup, markup, totalTax, total };
  }, [groups]);

  /* ---- Inline-edit handlers ---- */

  function handleItemClick(e: React.MouseEvent, rowKey: string, item: ApiItem) {
    const td = (e.target as HTMLElement).closest('td');
    const col = (td?.dataset.col as ColumnKey) ?? null;
    const field = col ? nearestEditableField(col, showMarkup, showGst) : 'name';

    setEditInputs((prev) => {
      if (prev[rowKey]) return prev;
      return { ...prev, [rowKey]: initItemInputs(item) };
    });

    if (e.ctrlKey || e.metaKey) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.size === 0 && editState) next.add(editState.rowKey);
        if (next.has(rowKey)) {
          next.delete(rowKey);
          if (next.size <= 1) return new Set();
        } else {
          next.add(rowKey);
        }
        return next;
      });
      setEditState({ rowKey, field });
    } else {
      setSelectedRows(new Set());
      setEditState({ rowKey, field });
    }
    setSelectedKey(null);
  }

  function handleAssemblyClick(e: React.MouseEvent, rowKey: string, combo: ApiCombo) {
    const target = e.target as HTMLElement;
    const fieldEl = target.closest('[data-assembly-field]');
    const assemblyField = fieldEl?.getAttribute('data-assembly-field');
    const field: EditableFieldKey = assemblyField === 'quantity' ? 'quantity' : 'name';

    setEditInputs((prev) => {
      if (prev[rowKey]) return prev;
      return { ...prev, [rowKey]: initComboInputs(combo) };
    });

    if (e.ctrlKey || e.metaKey) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.size === 0 && editState) next.add(editState.rowKey);
        if (next.has(rowKey)) {
          next.delete(rowKey);
          if (next.size <= 1) return new Set();
        } else {
          next.add(rowKey);
        }
        return next;
      });
      setEditState({ rowKey, field });
    } else {
      setSelectedRows(new Set());
      setEditState({ rowKey, field });
    }
    setSelectedKey(null);
  }

  function handleCellSelect(rowKey: string, field: EditableFieldKey) {
    setEditState({ rowKey, field });
  }

  function handleInputChange(rowKey: string, field: EditableFieldKey, value: string) {
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
  }

  function navigateToRow(rowIdx: number, field: EditableFieldKey) {
    if (rowIdx < 0 || rowIdx >= visibleRowIndex.length) return;
    const target = visibleRowIndex[rowIdx];
    let effectiveField = field;
    if (target.kind === 'assembly') {
      effectiveField = ASSEMBLY_EDITABLE_FIELDS.includes(field) ? field : 'name';
    }
    setEditInputs((prev) => {
      if (prev[target.key]) return prev;
      const inputs = target.kind === 'assembly'
        ? initComboInputs(target.combo)
        : initItemInputs(target.item);
      return { ...prev, [target.key]: inputs };
    });
    setEditState({ rowKey: target.key, field: effectiveField });
  }

  function handleCellKeyDown(e: React.KeyboardEvent) {
    if (!editState) return;
    const currentRow = visibleRowIndex.find((r) => r.key === editState.rowKey);
    const fields = currentRow?.kind === 'assembly'
      ? ASSEMBLY_EDITABLE_FIELDS
      : getEditableFields(showMarkup, showGst);
    const colIdx = fields.indexOf(editState.field);
    const inNameCol = NAME_COL_FIELDS.includes(editState.field);

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (editState.field === 'component') {
          setEditState({ ...editState, field: 'name' });
        } else if (editState.field === 'description') {
          setEditState({ ...editState, field: 'component' });
        } else if (!inNameCol && colIdx > 0) {
          const prev = fields[colIdx - 1];
          setEditState({ ...editState, field: prev === 'description' ? 'component' : prev });
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (editState.field === 'name') {
          setEditState({ ...editState, field: 'component' });
        } else if (editState.field === 'component' || editState.field === 'description') {
          const qtyIdx = fields.indexOf('quantity');
          if (qtyIdx >= 0) setEditState({ ...editState, field: 'quantity' });
        } else if (colIdx < fields.length - 1) {
          setEditState({ ...editState, field: fields[colIdx + 1] });
        }
        break;
      case 'ArrowUp': {
        e.preventDefault();
        if (selectedRows.size > 1) break;
        if (editState.field === 'description') {
          setEditState({ ...editState, field: 'name' });
        } else if (editState.field === 'name' || editState.field === 'component') {
          const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
          if (rowIdx > 0) navigateToRow(rowIdx - 1, 'description');
        } else {
          const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
          if (rowIdx > 0) navigateToRow(rowIdx - 1, editState.field);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (selectedRows.size > 1) break;
        if (editState.field === 'name' || editState.field === 'component') {
          setEditState({ ...editState, field: 'description' });
        } else if (editState.field === 'description') {
          const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
          if (rowIdx >= 0 && rowIdx < visibleRowIndex.length - 1) navigateToRow(rowIdx + 1, 'name');
        } else {
          const rowIdx = visibleRowIndex.findIndex((r) => r.key === editState.rowKey);
          if (rowIdx >= 0 && rowIdx < visibleRowIndex.length - 1) navigateToRow(rowIdx + 1, editState.field);
        }
        break;
      }
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          if (editState.field === 'description') {
            setEditState({ ...editState, field: 'component' });
          } else if (editState.field === 'component') {
            setEditState({ ...editState, field: 'name' });
          } else if (!inNameCol && colIdx > 0) {
            const prev = fields[colIdx - 1];
            setEditState({ ...editState, field: prev === 'description' ? 'description' : prev });
          }
        } else {
          if (editState.field === 'name') {
            setEditState({ ...editState, field: 'component' });
          } else if (editState.field === 'component') {
            setEditState({ ...editState, field: 'description' });
          } else if (colIdx < fields.length - 1) {
            setEditState({ ...editState, field: fields[colIdx + 1] });
          }
        }
        break;
      case 'Escape':
      case 'Enter':
        e.preventDefault();
        setEditState(null);
        setSelectedRows(new Set());
        break;
    }
  }

  useEffect(() => {
    if (!editState) return;
    function onMouseDown(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('tr[data-item-row]')) return;
      setEditState(null);
      setSelectedRows(new Set());
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [editState]);

  const groupFilterActive = hiddenGroupIds.size > 0;

  const filteredGroups = useMemo(() => {
    let result = groups;

    if (hiddenGroupIds.size > 0) {
      result = result.filter((g, i) => !hiddenGroupIds.has(g.id ?? `group-${i}`));
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return result;

    return result
      .map((group) => {
        const filteredItems = (group.items ?? []).filter(
          (item) =>
            (item.name ?? '').toLowerCase().includes(term) ||
            (item.component ?? '').toLowerCase().includes(term) ||
            (item.description ?? '').toLowerCase().includes(term),
        );
        const filteredCombos = (group.combos ?? [])
          .map((combo) => {
            const comboNameMatch = (combo.name ?? '').toLowerCase().includes(term) ||
              (combo.component ?? '').toLowerCase().includes(term);
            const matchingItems = (combo.items ?? []).filter(
              (item) =>
                (item.name ?? '').toLowerCase().includes(term) ||
                (item.component ?? '').toLowerCase().includes(term) ||
                (item.description ?? '').toLowerCase().includes(term),
            );
            if (comboNameMatch || matchingItems.length > 0) {
              return { ...combo, items: comboNameMatch ? combo.items : matchingItems };
            }
            return null;
          })
          .filter(Boolean) as typeof group.combos;
        if (filteredItems.length > 0 || (filteredCombos && filteredCombos.length > 0)) {
          return { ...group, items: filteredItems, combos: filteredCombos };
        }
        return null;
      })
      .filter(Boolean) as ApiGroup[];
  }, [groups, searchTerm, hiddenGroupIds]);

  const visibleRowIndex = useMemo(() => {
    const rows: RowEntry[] = [];
    for (let gi = 0; gi < filteredGroups.length; gi++) {
      const g = filteredGroups[gi];
      const gId = g.id ?? `group-${gi}`;
      for (let ii = 0; ii < (g.items ?? []).length; ii++) {
        const item = g.items![ii];
        rows.push({ kind: 'item', key: `${gId}-item-${item.id ?? ii}`, item });
      }
      for (let ci = 0; ci < (g.combos ?? []).length; ci++) {
        const combo = g.combos![ci];
        const comboKey = `${gId}-combo-${combo.id ?? ci}`;
        rows.push({ kind: 'assembly', key: comboKey, combo });
        for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
          const item = combo.items![ii];
          rows.push({ kind: 'item', key: `${comboKey}-item-${item.id ?? ii}`, item });
        }
      }
    }
    return rows;
  }, [filteredGroups]);

  const tableDropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (!hasGroupLabelDrag(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setActiveDropKey('table-root');
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (activeDropKey === 'table-root') setActiveDropKey(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setActiveDropKey(null);
      const labelPayload = getGroupLabelDragData(e.dataTransfer);
      if (labelPayload && onGroupLabelDrop) {
        onGroupLabelDrop(labelPayload);
        return;
      }
    },
  };

  if (groups.length === 0) {
    return (
      <div
        className={cn(
          'min-h-[calc(100vh-12rem)] space-y-3 rounded-xl border-2 border-dashed p-1 transition-all',
          activeDropKey === 'table-root'
            ? 'border-emerald-400 bg-emerald-50/30 ring-2 ring-emerald-500/30'
            : 'border-transparent',
        )}
        {...tableDropProps}
      >
        {onOpenCatalogDrawer && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onOpenCatalogDrawer} title="Open catalogue">
              <Package className="h-4 w-4" />
            </Button>
            {onSave && (
              <Button
                size="sm"
                variant="outline"
                disabled={!isDirty}
                onClick={() => onSave(dirtyEdits)}
                title="Save changes"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <div
          className={cn(
            'flex min-h-[12rem] items-center justify-center rounded-lg border-2 border-dashed text-sm text-slate-500 transition-all',
            activeDropKey === 'table-root'
              ? 'border-emerald-400 bg-emerald-50/40'
              : 'border-slate-200',
          )}
        >
          {activeDropKey === 'table-root'
            ? 'Release anywhere to create a new group'
            : 'No groups yet. Add a group or drag a group label here.'}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-[calc(100vh-12rem)] space-y-3 rounded-xl border-2 border-dashed p-1 transition-all',
        activeDropKey === 'table-root'
          ? 'border-emerald-400 bg-emerald-50/30 ring-2 ring-emerald-500/30'
          : 'border-transparent',
      )}
      {...tableDropProps}
    >
      <div
        data-slot="quote-line-items-toolbar"
        className="sticky top-[105px] z-[9] flex cursor-pointer items-center justify-between rounded-lg border-2 border-slate-400 bg-slate-100 px-5 py-4 shadow-md transition-colors hover:bg-slate-200"
        onClick={toggleAll}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center text-slate-600">
            {allCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
          <Layers className="h-4 w-4 text-slate-600" />
          <span onClick={(e) => e.stopPropagation()}>
            <DropdownMenu open={groupFilterOpen} onOpenChange={setGroupFilterOpen}>
              <DropdownMenuTrigger>
                <span
                  className="group/groupfilter inline-flex !cursor-default items-center gap-1"
                  title={groupFilterActive ? 'Group filter active' : 'Filter groups'}
                >
                  <span className="text-sm font-semibold text-slate-800">
                    {groups.length} group{groups.length !== 1 ? 's' : ''} &middot; {totalItems} line
                    {totalItems !== 1 ? 's' : ''}
                  </span>
                  {groupFilterActive ? (
                    <Filter className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Filter className="h-4 w-4 text-slate-400 opacity-0 group-hover/groupfilter:opacity-100 transition-opacity" />
                  )}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]" onMouseLeave={() => setGroupFilterOpen(false)}>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Filter groups</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      onClick={() => setHiddenGroupIds(new Set())}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      onClick={() =>
                        setHiddenGroupIds(
                          new Set(groups.map((g, i) => g.id ?? `group-${i}`)),
                        )
                      }
                    >
                      None
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {groups.map((g, i) => {
                  const gId = g.id ?? `group-${i}`;
                  const label = groupLabel(g, i);
                  const isVisible = !hiddenGroupIds.has(gId);
                  return (
                    <DropdownMenuItem
                      key={gId}
                      onClick={(e) => {
                        e.preventDefault();
                        setHiddenGroupIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(gId)) next.delete(gId);
                          else next.add(gId);
                          return next;
                        });
                      }}
                      closeOnClick={false}
                      className="justify-between"
                    >
                      <span className={cn('text-sm', !isVisible && 'text-slate-400')}>
                        {label}
                      </span>
                      {isVisible ? (
                        <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="relative w-96">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search line items…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 border-slate-400 bg-white pl-8 pr-8 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {onOpenCatalogDrawer && (
            <Button size="sm" variant="outline" onClick={onOpenCatalogDrawer} title="Open catalogue">
              <Package className="h-4 w-4" />
            </Button>
          )}
          {onSave && (
            <Button
              size="sm"
              variant="outline"
              disabled={!isDirty}
              onClick={() => onSave(dirtyEdits)}
              title="Save changes"
            >
              <Save className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-sm text-slate-600">
            Subtotal{' '}
            <span className="text-base font-semibold tabular-nums text-slate-900">
              {formatCurrency(grandTotals.subTotal)}
            </span>
          </div>
          <div
            className="group/markup flex !cursor-default select-none items-center gap-1 text-sm text-slate-600 transition-opacity hover:opacity-70"
            onClick={() => {
              setShowMarkup((v) => !v);
              setSuppressMarkupIcon(true);
            }}
            onMouseLeave={() => setSuppressMarkupIcon(false)}
            title={showMarkup ? 'Hide markup column' : 'Show markup column'}
          >
            <span className="relative inline-flex items-center">
              {showMarkup ? (
                <EyeOff className={cn('h-3.5 w-3.5 text-red-500 transition-opacity', suppressMarkupIcon ? 'opacity-0' : 'opacity-0 group-hover/markup:opacity-100')} />
              ) : (
                <>
                  <EyeOff className={cn('h-3.5 w-3.5 text-red-400 transition-opacity', suppressMarkupIcon ? 'opacity-100' : 'group-hover/markup:opacity-0')} />
                  <Eye className={cn('absolute inset-0 h-3.5 w-3.5 text-green-500 transition-opacity', suppressMarkupIcon ? 'opacity-0' : 'opacity-0 group-hover/markup:opacity-100')} />
                </>
              )}
            </span>
            Markup{' '}
            <span className={cn('text-base font-semibold tabular-nums text-slate-900', !showMarkup && 'opacity-40')}>
              {formatCurrency(grandTotals.markup)}
            </span>
          </div>
          <div
            className="group/gst flex !cursor-default select-none items-center gap-1 text-sm text-slate-600 transition-opacity hover:opacity-70"
            onClick={() => {
              setShowGst((v) => !v);
              setSuppressGstIcon(true);
            }}
            onMouseLeave={() => setSuppressGstIcon(false)}
            title={showGst ? 'Hide GST column' : 'Show GST column'}
          >
            <span className="relative inline-flex items-center">
              {showGst ? (
                <EyeOff className={cn('h-3.5 w-3.5 text-red-500 transition-opacity', suppressGstIcon ? 'opacity-0' : 'opacity-0 group-hover/gst:opacity-100')} />
              ) : (
                <>
                  <EyeOff className={cn('h-3.5 w-3.5 text-red-400 transition-opacity', suppressGstIcon ? 'opacity-100' : 'group-hover/gst:opacity-0')} />
                  <Eye className={cn('absolute inset-0 h-3.5 w-3.5 text-green-500 transition-opacity', suppressGstIcon ? 'opacity-0' : 'opacity-0 group-hover/gst:opacity-100')} />
                </>
              )}
            </span>
            GST{' '}
            <span className={cn('text-base font-semibold tabular-nums text-slate-900', !showGst && 'opacity-40')}>
              {formatCurrency(grandTotals.totalTax)}
            </span>
          </div>
          <div className="text-sm text-slate-600">
            Total{' '}
            <span className="text-xl font-bold tabular-nums text-slate-950">
              {formatCurrency(grandTotals.total)}
            </span>
          </div>
        </div>
      </div>

      {activeDropKey === 'table-root' && (
        <div className="rounded-lg bg-emerald-100/80 px-4 py-2.5 text-center text-xs font-medium text-emerald-700">
          Release anywhere to create a new group
        </div>
      )}

      {searchTerm && filteredGroups.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-sm text-slate-400">
          No line items match &ldquo;{searchTerm}&rdquo;
        </div>
      )}

      {filteredGroups.map((group, groupIndex) => {
        const gId = group.id ?? `group-${groupIndex}`;
        const label = groupLabel(group, groupIndex);
        const isCollapsed = searchTerm ? false : collapsed.has(gId);
        const dropKey = `group-drop-${gId}`;
        const isDropActive = activeDropKey === dropKey;

        const standaloneItems = group.items ?? [];
        const combos = group.combos ?? [];
        const standaloneTotal = standaloneItems.reduce((sum, it) => sum + (it.total ?? 0), 0);
        const comboTotal = combos.reduce((sum, c) => sum + (c.total ?? 0), 0);
        const groupTotal = standaloneTotal + comboTotal;
        const totalLineCount =
          standaloneItems.length +
          combos.reduce((cs, c) => cs + (c.items?.length ?? 0), 0);

        const dropProps = {
          onDragOver: (e: React.DragEvent) => {
            if (hasGroupLabelDrag(e.dataTransfer)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            setActiveDropKey(dropKey);
          },
          onDragLeave: (e: React.DragEvent) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            if (activeDropKey === dropKey) setActiveDropKey(null);
          },
          onDrop: (e: React.DragEvent) => {
            if (hasGroupLabelDrag(e.dataTransfer)) return;
            e.preventDefault();
            setActiveDropKey(null);
            const payload = getCatalogDragData(e.dataTransfer);
            if (!payload) return;
            onCatalogDrop(payload, group.id);
          },
        };

        return (
          <div
            key={gId}
            {...dropProps}
            className={cn(
              'overflow-hidden rounded-lg border shadow-sm transition-all',
              isDropActive
                ? 'border-amber-400 ring-2 ring-amber-500/30'
                : 'border-slate-200',
            )}
          >
            {/* Group header */}
            <div
              className={cn(
                'flex cursor-pointer items-center gap-2 bg-blue-100 px-4 py-3 transition-colors hover:bg-blue-200',
                selectedKey === `group-${gId}` && 'ring-2 ring-inset ring-amber-300 bg-amber-50/60',
              )}
              onClick={() => {
                setSelectedKey(selectedKey === `group-${gId}` ? null : `group-${gId}`);
                toggleCollapse(gId);
              }}
            >
              <span className="flex items-center text-blue-600">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>

              <GripVertical className="h-4 w-4 text-blue-400" />

              <div className="flex-1">
                <span className="text-sm font-semibold text-blue-950">{label}</span>
                {group.description && label !== group.description && (
                  <span className="ml-2 text-xs text-blue-700">{group.description}</span>
                )}
              </div>

              <span className="text-xs tabular-nums text-blue-700">
                {totalLineCount} item{totalLineCount !== 1 ? 's' : ''}
                {combos.length > 0 && ` · ${combos.length} assembl${combos.length !== 1 ? 'ies' : 'y'}`}
              </span>
              <span className="text-sm font-medium tabular-nums text-blue-900">
                {formatCurrency(groupTotal)}
              </span>

              {(onEditGroup || onDeleteGroup || onMoveGroupUp || onMoveGroupDown) && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {onEditGroup && (
                      <DropdownMenuItem onClick={() => onEditGroup(gId)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit group
                      </DropdownMenuItem>
                    )}
                    {onMoveGroupUp && groupIndex > 0 && (
                      <DropdownMenuItem onClick={() => onMoveGroupUp(gId)}>
                        <ArrowUp className="mr-2 h-3.5 w-3.5" />
                        Move up
                      </DropdownMenuItem>
                    )}
                    {onMoveGroupDown && groupIndex < groups.length - 1 && (
                      <DropdownMenuItem onClick={() => onMoveGroupDown(gId)}>
                        <ArrowDown className="mr-2 h-3.5 w-3.5" />
                        Move down
                      </DropdownMenuItem>
                    )}
                    {onDeleteGroup && (
                      <DropdownMenuItem
                        onClick={() => onDeleteGroup(gId)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete group
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Drop indicator */}
            {isDropActive && (
              <div className="bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700">
                Release to add catalogue item to &ldquo;{label}&rdquo;
              </div>
            )}

            {/* Group body - items table */}
            {!isCollapsed && (
              <div className="bg-white">
                {totalLineCount > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed divide-y divide-slate-100 text-sm">
                      <colgroup>
                        <col className="w-[32%]" />
                        <col className="w-[10%]" />
                        <col className="w-[10%]" />
                        <col className="w-[8%]" />
                        <col className="w-[9%]" />
                        <col className="w-[10%]" />
                        {showMarkup && <col className="w-[8%]" />}
                        {showGst && <col className="w-[7%]" />}
                        <col className="w-[10%]" />
                        <col className="w-10" />
                      </colgroup>
                      <thead className="bg-slate-50/50">
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          <th scope="col" className="px-4 py-2">Name</th>
                          <th scope="col" className="px-4 py-2">Type</th>
                          <th scope="col" className="px-4 py-2">Category</th>
                          <th scope="col" className="px-4 py-2 text-right">Qty</th>
                          <th scope="col" className="px-4 py-2 text-right">Unit</th>
                          <th scope="col" className="px-4 py-2 text-right">Extended</th>
                          {showMarkup && <th scope="col" className="px-4 py-2 text-right">Markup</th>}
                          {showGst && <th scope="col" className="px-4 py-2 text-right">GST</th>}
                          <th scope="col" className="px-4 py-2 text-right">Total</th>
                          <th scope="col" className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {/* Standalone items */}
                        {standaloneItems.map((item, idx) => {
                          const itemKey = `${gId}-item-${item.id ?? idx}`;
                          const itemEditing = editState?.rowKey === itemKey || (selectedRows.has(itemKey) && editState !== null);
                          const itemPrimary = editState?.rowKey === itemKey;
                          return (
                            <ItemRow
                              key={itemKey}
                              item={item}
                              rowKey={itemKey}
                              showMarkup={showMarkup}
                              showGst={showGst}
                              isEditing={itemEditing}
                              selectedField={itemEditing ? (editState?.field ?? null) : null}
                              editInputs={editInputs[itemKey] ?? null}
                              isPrimaryEdit={itemPrimary}
                              isMultiSelected={selectedRows.size > 1 && selectedRows.has(itemKey)}
                              isDirtyRow={dirtyRowKeys.has(itemKey)}
                              onRowClick={handleItemClick}
                              onCellSelect={handleCellSelect}
                              onInputChange={handleInputChange}
                              onCellKeyDown={handleCellKeyDown}
                              onDelete={onDeleteItem}
                            />
                          );
                        })}

                        {/* Assembly (combo) groups */}
                        {combos.map((combo, comboIdx) => {
                          const comboKey = `${gId}-combo-${combo.id ?? comboIdx}`;
                          const isComboCollapsed = searchTerm ? false : collapsedCombos.has(comboKey);
                          const comboItems = combo.items ?? [];
                          const comboItemCount = comboItems.length;

                          return (
                            <AssemblyBlock
                              key={comboKey}
                              combo={combo}
                              comboKey={comboKey}
                              comboItems={comboItems}
                              comboItemCount={comboItemCount}
                              isCollapsed={isComboCollapsed}
                              onToggle={() => toggleCombo(comboKey)}
                              showMarkup={showMarkup}
                              showGst={showGst}
                              editState={editState}
                              editInputs={editInputs}
                              selectedRows={selectedRows}
                              dirtyRowKeys={dirtyRowKeys}
                              onItemClick={handleItemClick}
                              onAssemblyClick={handleAssemblyClick}
                              onCellSelect={handleCellSelect}
                              onInputChange={handleInputChange}
                              onCellKeyDown={handleCellKeyDown}
                              onDeleteCombo={onDeleteCombo}
                              onDeleteItem={onDeleteItem}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                    Drag catalogue items here to add lines
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
