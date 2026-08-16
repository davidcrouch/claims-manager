'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Boxes,
  StickyNote,
} from 'lucide-react';
import { formatCurrency } from '@/components/shared/detail';
import {
  getCatalogDragData,
  getGroupLabelDragData,
  hasCatalogDrag,
  hasGroupLabelDrag,
  type CatalogDragPayload,
  type GroupLabelDragPayload,
} from '@/components/catalog/catalog-drag';
import type { ApiCombo, ApiGroup, ApiItem, ApiScope, GroupDimensions } from '@/components/quotes/quote-line-items.types';
import { groupLabel, normalizeLineItemGroups } from '@/components/quotes/quote-line-items.utils';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export type LineNoteTargetType = 'group' | 'combo' | 'item';

export interface LineNoteEditRequest {
  targetType: LineNoteTargetType;
  targetId: string;
  label: string;
  note?: string | null;
}

function hasLineNote(note?: string | null): boolean {
  return !!note && note.trim().length > 0;
}

function LineNoteButton({
  hasNote,
  onClick,
  label,
}: {
  hasNote: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-7 w-7 p-0', hasNote && 'text-amber-600 hover:text-amber-700')}
      title={hasNote ? `Edit notes for ${label}` : `Add notes for ${label}`}
      aria-label={hasNote ? `Edit notes for ${label}` : `Add notes for ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <StickyNote className={cn('h-3.5 w-3.5', hasNote && 'fill-amber-100')} />
    </Button>
  );
}

/** Portal tooltip for row-level note hover (avoids table overflow clipping). */
function useLineNoteHover(note?: string | null, enabled?: boolean) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const active = !!enabled && hasLineNote(note);

  const handlers = active
    ? {
        onMouseEnter: (e: React.MouseEvent) => {
          setPos({ x: e.clientX, y: e.clientY });
          setOpen(true);
        },
        onMouseMove: (e: React.MouseEvent) => {
          setPos({ x: e.clientX, y: e.clientY });
        },
        onMouseLeave: () => setOpen(false),
      }
    : {};

  const popup =
    open && active && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-md whitespace-pre-wrap break-words rounded-md bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-lg"
            style={{
              left: Math.min(pos.x + 14, window.innerWidth - 320),
              top: Math.min(pos.y + 16, window.innerHeight - 120),
            }}
          >
            {note}
          </div>,
          document.body,
        )
      : null;

  return { handlers, popup };
}

function GroupNoteHoverBar({
  note,
  enabled,
  className,
  onClick,
  children,
}: {
  note?: string | null;
  enabled?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const noteHover = useLineNoteHover(note, enabled);
  return (
    <>
      {noteHover.popup}
      <div className={className} {...noteHover.handlers} onClick={onClick}>
        {children}
      </div>
    </>
  );
}

function lookupDisplay(l?: { name?: string; externalReference?: string }): string {
  if (!l) return '—';
  return l.name ?? l.externalReference ?? '—';
}

/* ---- Inline-edit types & helpers ---- */

type EditableFieldKey = 'name' | 'component' | 'description' | 'quantity' | 'unitType' | 'unitCost' | 'markupValue' | 'tax';
type ColumnKey = 'name' | 'type' | 'category' | 'quantity' | 'unitType' | 'unitCost' | 'extended' | 'markupValue' | 'tax' | 'total';

const UNIT_TYPE_OPTIONS = [
  { value: 'EA', label: 'EA' },
  { value: 'HR', label: 'HR' },
  { value: 'ITEM', label: 'Item' },
  { value: 'KM', label: 'KM' },
  { value: 'LM', label: 'LM' },
  { value: 'LOT', label: 'Lot' },
  { value: 'M2', label: 'M²' },
] as const;

function getEditableFields(
  showMarkup: boolean,
  showGst: boolean,
  showQuantities = true,
  showPricing = true,
): EditableFieldKey[] {
  const fields: EditableFieldKey[] = ['name', 'component', 'description'];
  if (showQuantities) {
    fields.push('quantity', 'unitType');
  }
  if (showPricing) {
    fields.push('unitCost');
    if (showMarkup) fields.push('markupValue');
    if (showGst) fields.push('tax');
  }
  return fields;
}

const NAME_COL_FIELDS: EditableFieldKey[] = ['name', 'component', 'description'];

function nearestEditableField(
  clicked: ColumnKey,
  showMarkup: boolean,
  showGst: boolean,
  showQuantities = true,
  showPricing = true,
): EditableFieldKey {
  const editableFields = getEditableFields(showMarkup, showGst, showQuantities, showPricing);
  if ((editableFields as string[]).includes(clicked)) return clicked as EditableFieldKey;

  const allCols: ColumnKey[] = ['name', 'type', 'category'];
  if (showQuantities) allCols.push('quantity', 'unitType');
  if (showPricing) {
    allCols.push('unitCost', 'extended');
    if (showMarkup) allCols.push('markupValue');
    if (showGst) allCols.push('tax');
    allCols.push('total');
  }

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
  | { kind: 'assembly'; key: string; combo: ApiCombo }
  | { kind: 'scope'; key: string; scope: ApiScope };

const ASSEMBLY_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];
const SCOPE_EDITABLE_FIELDS: EditableFieldKey[] = ['name', 'component', 'description', 'quantity'];

function initItemInputs(item: ApiItem): Record<EditableFieldKey, string> {
  return {
    name: item.name ?? '',
    component: item.component ?? '',
    description: item.description ?? '',
    quantity: String(item.quantity ?? 0),
    unitType: item.unitType?.externalReference ?? '',
    unitCost: String(item.unitCost ?? 0),
    markupValue: String(item.markupValue ?? 19),
    tax: typeof item.tax === 'number' ? String(item.tax) : '0',
  };
}

function initComboInputs(combo: ApiCombo): Record<EditableFieldKey, string> {
  return {
    name: combo.name ?? '',
    component: combo.component ?? '',
    description: combo.description ?? '',
    quantity: String(combo.quantity ?? 0),
    unitType: '',
    unitCost: '0',
    markupValue: '0',
    tax: '0',
  };
}

function initScopeInputs(scope: ApiScope): Record<EditableFieldKey, string> {
  return {
    name: scope.name ?? '',
    component: scope.component ?? '',
    description: scope.description ?? '',
    quantity: String(scope.quantity ?? 0),
    unitType: '',
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
  showQuantities = true,
  showPricing = true,
  showCategory = true,
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
  showSelect,
  isPicked,
  onTogglePick,
  contentDisabled,
  enableLineNotes,
  onEditLineNote,
}: {
  item: ApiItem;
  rowKey: string;
  indented?: boolean;
  showMarkup: boolean;
  showGst: boolean;
  showQuantities?: boolean;
  showPricing?: boolean;
  showCategory?: boolean;
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
  showSelect?: boolean;
  isPicked?: boolean;
  onTogglePick?: () => void;
  contentDisabled?: { quantities?: boolean; pricing?: boolean };
  enableLineNotes?: boolean;
  onEditLineNote?: (request: LineNoteEditRequest) => void;
}) {
  const qtyDisabled = contentDisabled?.quantities ?? false;
  const priceDisabled = contentDisabled?.pricing ?? false;
  const itemNote = item.note;
  const itemLabel = item.name ?? 'Item';
  const noteHover = useLineNoteHover(itemNote, enableLineNotes);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mismatches = item.mismatches ?? [];

  const qty = editInputs ? parseFloat(editInputs.quantity) || 0 : (item.quantity ?? 0);
  const unitCost = editInputs ? parseFloat(editInputs.unitCost) || 0 : (item.unitCost ?? 0);
  const mkVal = editInputs ? parseFloat(editInputs.markupValue) || 0 : (item.markupValue ?? 19);
  const taxPct = editInputs ? parseFloat(editInputs.tax) || 0 : (item.tax ?? 0);

  const extended = qty * unitCost;
  const markupAmt = item.markupType === 'fixed' ? mkVal * qty : extended * (mkVal / 100);
  const gstAmt = (extended + markupAmt) * (taxPct / 100);
  const total = extended + (showMarkup ? markupAmt : 0) + (showGst ? gstAmt : 0);

  useEffect(() => {
    if (isEditing && selectedField && isPrimaryEdit !== false) {
      const el = inputRefs.current[selectedField];
      if (el) { el.focus(); if ('select' in el && typeof el.select === 'function') el.select(); }
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
    <>
    {noteHover.popup}
    <tr
      data-item-row
      className={cn(
        'cursor-pointer transition-colors',
        showSelect && !isPicked && 'opacity-40',
        isEditing
          ? isMultiSelected
            ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
            : 'ring-2 ring-inset ring-amber-300 bg-amber-50/40'
          : isDirtyRow
            ? 'bg-emerald-100 hover:bg-emerald-200 hover:ring-2 hover:ring-inset hover:ring-emerald-400'
            : 'hover:bg-amber-50/40 hover:ring-2 hover:ring-inset hover:ring-amber-300',
      )}
      {...noteHover.handlers}
      onClick={(e) => {
        if (showSelect) {
          e.preventDefault();
          onTogglePick?.();
          return;
        }
        onRowClick(e, rowKey, item);
      }}
    >
      {showSelect && (
        <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={!!isPicked}
            onCheckedChange={() => onTogglePick?.()}
            aria-label={`Select ${item.name ?? item.component ?? 'item'}`}
          />
        </td>
      )}
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
      {showCategory && (
        <td data-col="category" className={cn(roCellCls, 'truncate text-slate-600')}>
          {[item.category, item.subCategory].filter(Boolean).join(' / ') || '—'}
        </td>
      )}

      {/* Qty (editable) */}
      {showQuantities && (
        <td data-col="quantity" className={cn(qtyDisabled ? cn(roCellCls, 'opacity-30') : editCellCls('quantity'), 'text-right')} onClick={qtyDisabled ? undefined : cellClick('quantity')}>
          {qtyDisabled ? (
            <span className="font-mono text-slate-400">—</span>
          ) : isEditing && editInputs ? (
            <input
              ref={(el) => { inputRefs.current.quantity = el; }}
              value={editInputs.quantity}
              onChange={(e) => onInputChange(rowKey, 'quantity', e.target.value)}
              onKeyDown={onCellKeyDown}
              className={inputCls('right')}
            />
          ) : (
            <span className="font-mono text-slate-700">{qty}</span>
          )}
        </td>
      )}

      {/* Unit (editable dropdown, e.g. M2, EA) */}
      {showQuantities && (
        <td data-col="unitType" className={cn(qtyDisabled ? cn(roCellCls, 'opacity-30') : editCellCls('unitType'), 'text-left')} onClick={qtyDisabled ? undefined : cellClick('unitType')}>
          {qtyDisabled ? (
            <span className="text-slate-400">—</span>
          ) : isEditing && editInputs ? (
            <select
              ref={(el) => { inputRefs.current.unitType = el as unknown as HTMLInputElement; }}
              value={editInputs.unitType}
              onChange={(e) => onInputChange(rowKey, 'unitType', e.target.value)}
              onKeyDown={onCellKeyDown}
              className="w-full bg-transparent px-4 py-2.5 text-sm text-slate-700 outline-none"
            >
              <option value="">—</option>
              {UNIT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <span className="text-slate-700">
              {editInputs?.unitType
                ? (UNIT_TYPE_OPTIONS.find((o) => o.value === editInputs.unitType)?.label ?? editInputs.unitType)
                : item.unitType ? lookupDisplay(item.unitType) : '—'}
            </span>
          )}
        </td>
      )}

      {/* Unit Price (editable) */}
      {showPricing && (
        <td data-col="unitCost" className={cn(priceDisabled ? cn(roCellCls, 'opacity-30') : editCellCls('unitCost'), 'text-right')} onClick={priceDisabled ? undefined : cellClick('unitCost')}>
          {priceDisabled ? (
            <span className="font-mono text-slate-400">—</span>
          ) : isEditing && editInputs ? (
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
      )}

      {/* Extended (computed) */}
      {showPricing && (
        <td data-col="extended" className={cn(roCellCls, 'text-right font-mono', priceDisabled ? 'opacity-30 text-slate-400' : 'text-slate-700')}>
          {priceDisabled ? '—' : formatCurrency(extended)}
        </td>
      )}

      {/* Markup (editable, conditional) */}
      {showPricing && showMarkup && (
        <td data-col="markupValue" className={cn(priceDisabled ? cn(roCellCls, 'opacity-30') : editCellCls('markupValue'), 'text-right')} onClick={priceDisabled ? undefined : cellClick('markupValue')}>
          {priceDisabled ? (
            <span className="font-mono text-slate-400">—</span>
          ) : isEditing && editInputs ? (
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
      {showPricing && showGst && (
        <td data-col="tax" className={cn(priceDisabled ? cn(roCellCls, 'opacity-30') : editCellCls('tax'), 'text-right')} onClick={priceDisabled ? undefined : cellClick('tax')}>
          {priceDisabled ? (
            <span className="font-mono text-slate-400">—</span>
          ) : isEditing && editInputs ? (
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
      {showPricing && (
        <td data-col="total" className={cn(roCellCls, 'text-right', priceDisabled ? 'opacity-30 font-mono text-slate-400' : 'font-medium text-slate-900')}>
          {priceDisabled ? '—' : formatCurrency(total)}
        </td>
      )}

      {/* Actions */}
      <td className="w-10 px-1 py-2.5 text-center">
        <div className="flex items-center justify-center gap-0.5">
          {enableLineNotes && item.id && onEditLineNote && (
            <LineNoteButton
              hasNote={hasLineNote(itemNote)}
              label={itemLabel}
              onClick={() =>
                onEditLineNote({
                  targetType: 'item',
                  targetId: item.id!,
                  label: itemLabel,
                  note: itemNote,
                })
              }
            />
          )}
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
        </div>
      </td>
      <LineNotesColumnCell
        show={!!enableLineNotes && !showPricing}
        note={itemNote}
        className={isEditing ? (isMultiSelected ? 'bg-blue-50/30' : 'bg-amber-50/40') : undefined}
      />
    </tr>
    </>
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
  showQuantities = true,
  showPricing = true,
  showCategory = true,
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
  showSelect,
  selectedIds,
  onToggleIds,
  showColumnToggles,
  contentShowQuantities,
  contentShowPricing,
  isOverridden,
  onToggleOverride,
  onToggleQuantities,
  onTogglePricing,
  enableLineNotes,
  onEditLineNote,
}: {
  combo: ApiCombo;
  comboKey: string;
  comboItems: ApiItem[];
  comboItemCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  showMarkup: boolean;
  showGst: boolean;
  showQuantities?: boolean;
  showPricing?: boolean;
  showCategory?: boolean;
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
  showSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleIds?: (ids: string[]) => void;
  showColumnToggles?: boolean;
  contentShowQuantities?: boolean;
  contentShowPricing?: boolean;
  isOverridden?: boolean;
  onToggleOverride?: () => void;
  onToggleQuantities?: () => void;
  onTogglePricing?: () => void;
  enableLineNotes?: boolean;
  onEditLineNote?: (request: LineNoteEditRequest) => void;
}) {
  const effectiveContentQty = contentShowQuantities ?? (showQuantities ?? true);
  const effectiveContentPrice = contentShowPricing ?? (showPricing ?? true);
  const assemblyContentDisabled = {
    quantities: (showQuantities ?? true) && !effectiveContentQty,
    pricing: (showPricing ?? true) && !effectiveContentPrice,
  };
  const comboNote = combo.note;
  const comboLabel = combo.name ?? 'Assembly';
  const noteHover = useLineNoteHover(comboNote, enableLineNotes);
  const comboName = combo.name ?? 'Assembly';
  const comboCategory =
    [combo.category, combo.subCategory].filter(Boolean).join(' / ') || '—';
  const isEditing = editState?.rowKey === comboKey || (selectedRows.has(comboKey) && editState !== null);
  const comboInputs = editInputs[comboKey] ?? null;
  const comboPickIds = [
    ...(combo.id ? [combo.id] : []),
    ...comboItems.map((i) => i.id!).filter(Boolean),
  ];
  const comboSelectedCount = comboPickIds.filter((id) => selectedIds?.has(id)).length;
  const comboChecked =
    comboPickIds.length === 0
      ? false
      : comboSelectedCount === 0
        ? false
        : comboSelectedCount === comboPickIds.length
          ? true
          : 'indeterminate';
  const comboPicked = !showSelect || comboChecked === true || comboChecked === 'indeterminate';

  const comboTotal = useMemo(() => {
    let sum = 0;
    for (let idx = 0; idx < comboItems.length; idx++) {
      const item = comboItems[idx];
      const itemKey = `${comboKey}-item-${item.id ?? idx}`;
      const inputs = editInputs[itemKey];
      const qty = inputs ? parseFloat(inputs.quantity) || 0 : (item.quantity ?? 0);
      const uc = inputs ? parseFloat(inputs.unitCost) || 0 : (item.unitCost ?? 0);
      const ext = qty * uc;
      const mkVal = inputs ? parseFloat(inputs.markupValue) || 0 : (item.markupValue ?? 19);
      const mkAmt = item.markupType === 'fixed' ? mkVal * qty : ext * (mkVal / 100);
      const taxPct = inputs
        ? parseFloat(inputs.tax) || 0
        : (item.tax ?? 0);
      const gstAmt = (ext + mkAmt) * (taxPct / 100);
      sum += ext + (showMarkup ? mkAmt : 0) + (showGst ? gstAmt : 0);
    }
    return sum;
  }, [comboItems, comboKey, showMarkup, showGst, editInputs]);
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
      {noteHover.popup}
      {/* Assembly header row */}
      <tr
        data-item-row
        className={cn(
          'relative cursor-pointer transition-colors',
          showSelect && !comboPicked && 'opacity-40',
          isEditing
            ? comboRing
            : dirtyRowKeys.has(comboKey)
              ? 'bg-emerald-200 hover:bg-emerald-300'
              : 'bg-slate-200 hover:bg-slate-300',
        )}
        {...noteHover.handlers}
        onClick={(e) => {
          if (showSelect) {
            onToggleIds?.(comboPickIds);
            return;
          }
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
        {showSelect && (
          <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={comboChecked === true}
              indeterminate={comboChecked === 'indeterminate'}
              onCheckedChange={() => onToggleIds?.(comboPickIds)}
              aria-label={`Select assembly ${comboName}`}
            />
          </td>
        )}
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
          {showColumnToggles && onToggleQuantities && onTogglePricing && onToggleOverride && (
            <div className="absolute left-3/4 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <HeaderVisibilityToggles
                isOverridden={isOverridden ?? false}
                onToggleOverride={onToggleOverride}
                showQuantities={effectiveContentQty}
                showPricing={effectiveContentPrice}
                onToggleQuantities={onToggleQuantities}
                onTogglePricing={onTogglePricing}
              />
            </div>
          )}
        </td>
        <td className={cn('px-4 py-2.5 text-xs text-slate-600', isEditing && comboBg)}>Assembly</td>
        {showCategory && (
          <td className={cn('px-4 py-2.5 text-xs text-slate-600', isEditing && comboBg)}>{comboCategory}</td>
        )}
        {showQuantities && (
          <td
            data-col="quantity"
            data-assembly-field="quantity"
            className={cn(
              'whitespace-nowrap text-right',
              assemblyContentDisabled.quantities
                ? cn('px-4 py-2.5 opacity-30')
                : isEditing
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
            onClick={assemblyContentDisabled.quantities ? undefined : isEditing ? (e) => { e.stopPropagation(); onCellSelect(comboKey, 'quantity'); } : undefined}
          >
            {assemblyContentDisabled.quantities ? (
              <span className="font-mono text-slate-400">—</span>
            ) : isEditing && comboInputs ? (
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
        )}
        {showQuantities && <td className={cn('px-4 py-2.5', assemblyContentDisabled.quantities && 'opacity-30', isEditing && comboBg)} />}
        {showPricing && <td className={cn('px-4 py-2.5', assemblyContentDisabled.pricing && 'opacity-30', isEditing && comboBg)} />}
        {showPricing && <td className={cn('px-4 py-2.5', assemblyContentDisabled.pricing && 'opacity-30', isEditing && comboBg)} />}
        {showPricing && showMarkup && <td className={cn('px-4 py-2.5', assemblyContentDisabled.pricing && 'opacity-30', isEditing && comboBg)} />}
        {showPricing && showGst && <td className={cn('px-4 py-2.5', assemblyContentDisabled.pricing && 'opacity-30', isEditing && comboBg)} />}
        {showPricing && (
          <td className={cn('whitespace-nowrap px-4 py-2.5 text-right', assemblyContentDisabled.pricing ? 'opacity-30 font-mono text-slate-400' : 'font-semibold text-slate-900', isEditing && comboBg)}>
            {assemblyContentDisabled.pricing ? '—' : formatCurrency(comboTotal)}
          </td>
        )}

        {/* Actions */}
        <td className="w-10 px-1 py-2.5 text-center">
          <div className="flex items-center justify-center gap-0.5">
            {enableLineNotes && combo.id && onEditLineNote && (
              <LineNoteButton
                hasNote={hasLineNote(comboNote)}
                label={comboLabel}
                onClick={() =>
                  onEditLineNote({
                    targetType: 'combo',
                    targetId: combo.id!,
                    label: comboLabel,
                    note: comboNote,
                  })
                }
              />
            )}
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
          </div>
        </td>
        <LineNotesColumnCell
          show={!!enableLineNotes && !showPricing}
          note={comboNote}
          className={isEditing ? comboBg : undefined}
        />
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
              showQuantities={showQuantities}
              showPricing={showPricing}
              showCategory={showCategory}
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
              showSelect={showSelect}
              isPicked={!showSelect || (!!item.id && !!selectedIds?.has(item.id))}
              onTogglePick={() => item.id && onToggleIds?.([item.id])}
              contentDisabled={assemblyContentDisabled}
              enableLineNotes={enableLineNotes}
              onEditLineNote={onEditLineNote}
            />
          );
        })}
    </>
  );
}

function ScopeBlock({
  scope,
  scopeKey,
  isCollapsed,
  onToggle,
  showMarkup,
  showGst,
  showQuantities = true,
  showPricing = true,
  showCategory = true,
  editState,
  editInputs,
  selectedRows,
  dirtyRowKeys,
  collapsedCombos,
  onToggleCombo,
  onItemClick,
  onAssemblyClick,
  onScopeClick,
  onCellSelect,
  onInputChange,
  onCellKeyDown,
  onDeleteScope,
  onDeleteCombo,
  onDeleteItem,
  showSelect,
  selectedIds,
  onToggleIds,
  isDropActive = false,
  dropHint,
  showColumnToggles,
  isOverridden,
  onToggleOverride,
  onToggleQuantities,
  onTogglePricing,
  resolveChildVisibility,
  toggleChildField,
  isChildOverridden,
  toggleChildOverride,
  enableLineNotes,
  onEditLineNote,
}: {
  scope: ApiScope;
  scopeKey: string;
  isCollapsed: boolean;
  onToggle: () => void;
  showMarkup: boolean;
  showGst: boolean;
  showQuantities?: boolean;
  showPricing?: boolean;
  showCategory?: boolean;
  editState: { rowKey: string; field: EditableFieldKey } | null;
  editInputs: Record<string, Record<EditableFieldKey, string>>;
  selectedRows: Set<string>;
  dirtyRowKeys: Set<string>;
  collapsedCombos: Set<string>;
  onToggleCombo: (key: string) => void;
  onItemClick: (e: React.MouseEvent, rowKey: string, item: ApiItem) => void;
  onAssemblyClick: (e: React.MouseEvent, rowKey: string, combo: ApiCombo) => void;
  onScopeClick: (e: React.MouseEvent, rowKey: string, scope: ApiScope) => void;
  onCellSelect: (rowKey: string, field: EditableFieldKey) => void;
  onInputChange: (rowKey: string, field: EditableFieldKey, value: string) => void;
  onCellKeyDown: (e: React.KeyboardEvent) => void;
  onDeleteScope?: (scopeId: string) => void;
  onDeleteCombo?: (comboId: string) => void;
  onDeleteItem?: (request: DeleteItemRequest) => void;
  showSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleIds?: (ids: string[]) => void;
  isDropActive?: boolean;
  dropHint?: string;
  showColumnToggles?: boolean;
  isOverridden?: boolean;
  onToggleOverride?: () => void;
  onToggleQuantities?: () => void;
  onTogglePricing?: () => void;
  resolveChildVisibility?: (key: string, parentQty: boolean, parentPrice: boolean) => { showQuantities: boolean; showPricing: boolean };
  toggleChildField?: (key: string, field: 'showQuantities' | 'showPricing', current: boolean) => void;
  isChildOverridden?: (key: string) => boolean;
  toggleChildOverride?: (key: string, parentQty: boolean, parentPrice: boolean) => void;
  enableLineNotes?: boolean;
  onEditLineNote?: (request: LineNoteEditRequest) => void;
}) {
  const scopeName = scope.name ?? 'Scope';
  const scopeNote = scope.note;
  const noteHover = useLineNoteHover(scopeNote, enableLineNotes);
  const scopeCategory =
    [scope.category, scope.subCategory].filter(Boolean).join(' / ') || '—';
  const isEditing = editState?.rowKey === scopeKey || (selectedRows.has(scopeKey) && editState !== null);
  const scopeInputs = editInputs[scopeKey] ?? null;
  const scopeItems = scope.items ?? [];
  const scopeCombos = scope.combos ?? [];

  const allChildIds = useMemo(() => {
    const ids: string[] = [];
    if (scope.id) ids.push(scope.id);
    for (const item of scopeItems) { if (item.id) ids.push(item.id); }
    for (const combo of scopeCombos) {
      if (combo.id) ids.push(combo.id);
      for (const item of combo.items ?? []) { if (item.id) ids.push(item.id); }
    }
    return ids;
  }, [scope.id, scopeItems, scopeCombos]);

  const scopeSelectedCount = allChildIds.filter((id) => selectedIds?.has(id)).length;
  const scopeChecked =
    allChildIds.length === 0
      ? false
      : scopeSelectedCount === 0
        ? false
        : scopeSelectedCount === allChildIds.length
          ? true
          : 'indeterminate';
  const scopePicked = !showSelect || scopeChecked === true || scopeChecked === 'indeterminate';

  const scopeTotal = useMemo(() => {
    let sum = 0;
    function addItem(item: ApiItem, itemKey: string) {
      const inputs = editInputs[itemKey];
      const qty = inputs ? parseFloat(inputs.quantity) || 0 : (item.quantity ?? 0);
      const uc = inputs ? parseFloat(inputs.unitCost) || 0 : (item.unitCost ?? 0);
      const ext = qty * uc;
      const mkVal = inputs ? parseFloat(inputs.markupValue) || 0 : (item.markupValue ?? 19);
      const mkAmt = item.markupType === 'fixed' ? mkVal * qty : ext * (mkVal / 100);
      const taxPct = inputs ? parseFloat(inputs.tax) || 0 : (item.tax ?? 0);
      const gstAmt = (ext + mkAmt) * (taxPct / 100);
      sum += ext + (showMarkup ? mkAmt : 0) + (showGst ? gstAmt : 0);
    }
    for (let idx = 0; idx < scopeItems.length; idx++) {
      const item = scopeItems[idx];
      addItem(item, `${scopeKey}-item-${item.id ?? idx}`);
    }
    for (let ci = 0; ci < scopeCombos.length; ci++) {
      const combo = scopeCombos[ci];
      const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
      for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
        const item = combo.items![ii];
        addItem(item, `${comboKey}-item-${item.id ?? ii}`);
      }
    }
    return sum;
  }, [scopeItems, scopeCombos, scopeKey, showMarkup, showGst, editInputs]);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const componentInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const isPrimary = editState?.rowKey === scopeKey;
  const isScopeMultiSelected = selectedRows.size > 1 && selectedRows.has(scopeKey);
  const scopeBg = isScopeMultiSelected ? 'bg-blue-50/30' : 'bg-violet-50/40';
  const scopeRing = isScopeMultiSelected
    ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
    : 'ring-2 ring-inset ring-violet-300 bg-violet-50/40';

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

  const totalChildLineCount =
    scopeItems.length +
    scopeCombos.reduce((cs, c) => cs + (c.items?.length ?? 0), 0);

  return (
    <>
      {noteHover.popup}
      {/* Scope header row */}
      <tr
        data-item-row
        className={cn(
          'relative cursor-pointer transition-colors',
          showSelect && !scopePicked && 'opacity-40',
          isEditing
            ? scopeRing
            : dirtyRowKeys.has(scopeKey)
              ? 'bg-emerald-200 hover:bg-emerald-300'
              : 'bg-violet-100 hover:bg-violet-200',
        )}
        {...noteHover.handlers}
        onClick={(e) => {
          if (showSelect) {
            onToggleIds?.(allChildIds);
            return;
          }
          if (isEditing) {
            onToggle();
            return;
          }
          const target = e.target as HTMLElement;
          const fieldArea = target.closest('[data-scope-field]');
          if (fieldArea) {
            onScopeClick(e, scopeKey, scope);
            if (isCollapsed) onToggle();
          } else {
            onToggle();
          }
        }}
      >
        {showSelect && (
          <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={scopeChecked === true}
              indeterminate={scopeChecked === 'indeterminate'}
              onCheckedChange={() => onToggleIds?.(allChildIds)}
              aria-label={`Select scope ${scopeName}`}
            />
          </td>
        )}
        <td
          className={cn(
            'p-0',
            isEditing
              ? isScopeMultiSelected
                ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
                : 'shadow-[inset_0_0_0_1px_#8b5cf633] bg-violet-50/40'
              : 'px-4 py-2.5 hover:bg-violet-50 hover:shadow-[inset_0_0_0_2px_#7c3aed]',
          )}
          colSpan={1}
        >
          {isEditing && scopeInputs ? (
            <div className="pl-2">
              <div className="flex items-center">
                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-violet-600" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-violet-600" />
                  )}
                  <Boxes className="h-3.5 w-3.5 text-violet-500" />
                </div>
                <div
                  className={cn(
                    'flex-1 min-w-0 rounded-sm transition-shadow',
                    editState?.field === 'name'
                      ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                      : '',
                  )}
                  onClick={(e) => { e.stopPropagation(); onCellSelect(scopeKey, 'name'); }}
                >
                  <input
                    ref={nameInputRef}
                    value={scopeInputs.name}
                    onChange={(e) => onInputChange(scopeKey, 'name', e.target.value)}
                    onKeyDown={onCellKeyDown}
                    onFocus={() => onCellSelect(scopeKey, 'name')}
                    placeholder="Scope name…"
                    className="w-full bg-transparent px-4 py-2 text-sm font-semibold text-violet-900 outline-none placeholder:text-violet-300 truncate"
                  />
                </div>
                <div
                  className={cn(
                    'flex-1 min-w-0 border-l border-violet-200 rounded-sm transition-shadow',
                    editState?.field === 'component'
                      ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                      : '',
                  )}
                  onClick={(e) => { e.stopPropagation(); onCellSelect(scopeKey, 'component'); }}
                >
                  <input
                    ref={componentInputRef}
                    value={scopeInputs.component}
                    onChange={(e) => onInputChange(scopeKey, 'component', e.target.value)}
                    onKeyDown={onCellKeyDown}
                    onFocus={() => onCellSelect(scopeKey, 'component')}
                    placeholder="Component…"
                    className="w-full bg-transparent px-4 py-2 text-sm text-violet-600 outline-none placeholder:text-violet-300 truncate"
                  />
                </div>
              </div>
              <div
                className={cn(
                  'border-t border-violet-100 rounded-sm transition-shadow',
                  editState?.field === 'description'
                    ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                    : '',
                )}
                onClick={(e) => { e.stopPropagation(); onCellSelect(scopeKey, 'description'); }}
              >
                <input
                  ref={descriptionInputRef}
                  value={scopeInputs.description}
                  onChange={(e) => onInputChange(scopeKey, 'description', e.target.value)}
                  onKeyDown={onCellKeyDown}
                  onFocus={() => onCellSelect(scopeKey, 'description')}
                  placeholder="Description…"
                  className="w-full bg-transparent px-4 py-1.5 text-xs text-violet-500 outline-none placeholder:text-violet-300"
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[2.75rem] items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-violet-600" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-violet-600" />
              )}
              <Boxes className="h-3.5 w-3.5 text-violet-500" />
              <div
                className="flex-1 min-w-0"
                data-scope-field="name"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-violet-900 truncate">
                    {scopeName}
                    {(scopeInputs?.component ?? scope.component) && (
                      <span className="font-normal text-violet-600">
                        {' - '}{scopeInputs?.component ?? scope.component}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 min-h-4 text-xs text-violet-500">
                  {scopeInputs?.description ?? scope.description ?? '\u00a0'}
                </p>
              </div>
            </div>
          )}
          {showColumnToggles && onToggleQuantities && onTogglePricing && onToggleOverride && (
            <div className="absolute left-3/4 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <HeaderVisibilityToggles
                isOverridden={isOverridden ?? false}
                onToggleOverride={onToggleOverride}
                showQuantities={showQuantities ?? true}
                showPricing={showPricing ?? true}
                onToggleQuantities={onToggleQuantities}
                onTogglePricing={onTogglePricing}
                colorScheme="violet"
              />
            </div>
          )}
        </td>
        <td className={cn('px-4 py-2.5 text-xs text-violet-700', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))}>Scope</td>
        {showCategory && (
          <td className={cn('px-4 py-2.5 text-xs text-violet-700', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))}>{scopeCategory}</td>
        )}
        {showQuantities && (
          <td
            data-col="quantity"
            data-scope-field="quantity"
            className={cn(
              'whitespace-nowrap text-right',
              isEditing
                ? cn('p-0 transition-shadow', editState?.field === 'quantity'
                    ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
                    : isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg)
                : 'px-4 py-2.5 hover:bg-violet-50 hover:shadow-[inset_0_0_0_2px_#7c3aed]',
            )}
            onClick={isEditing ? (e) => { e.stopPropagation(); onCellSelect(scopeKey, 'quantity'); } : undefined}
          >
            {isEditing && scopeInputs ? (
              <input
                ref={qtyInputRef}
                value={scopeInputs.quantity}
                onChange={(e) => onInputChange(scopeKey, 'quantity', e.target.value)}
                onKeyDown={onCellKeyDown}
                onFocus={() => onCellSelect(scopeKey, 'quantity')}
                className="w-full bg-transparent px-4 py-2.5 text-right font-mono text-sm text-violet-700 outline-none"
              />
            ) : (
              <span className="font-mono text-sm text-violet-700">{scope.quantity ?? '—'}</span>
            )}
          </td>
        )}
        {showQuantities && (
          <td className={cn('px-4 py-2.5', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))} />
        )}
        {showPricing && (
          <td className={cn('px-4 py-2.5', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))} />
        )}
        {showPricing && (
          <td className={cn('px-4 py-2.5', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))} />
        )}
        {showPricing && showMarkup && (
          <td className={cn('px-4 py-2.5', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))} />
        )}
        {showPricing && showGst && (
          <td className={cn('px-4 py-2.5', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))} />
        )}
        {showPricing && (
          <td className={cn('whitespace-nowrap px-4 py-2.5 text-right', isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg))}>
            <div className="flex items-center justify-end gap-3">
              <span className="text-xs tabular-nums text-violet-700">
                {totalChildLineCount} item{totalChildLineCount !== 1 ? 's' : ''}
                {scopeCombos.length > 0 && ` · ${scopeCombos.length} assembl${scopeCombos.length !== 1 ? 'ies' : 'y'}`}
              </span>
              <span className="font-semibold text-violet-900">{formatCurrency(scopeTotal)}</span>
            </div>
          </td>
        )}
        <td className={cn(
          'px-2',
          !showPricing ? 'whitespace-nowrap text-right' : 'w-10',
          isEditing && (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg),
        )}>
          <div className="flex items-center justify-end gap-0.5">
            {!showPricing && (
              <span className="mr-2 text-xs tabular-nums text-violet-700">
                {totalChildLineCount} item{totalChildLineCount !== 1 ? 's' : ''}
                {scopeCombos.length > 0 && ` · ${scopeCombos.length} assembl${scopeCombos.length !== 1 ? 'ies' : 'y'}`}
              </span>
            )}
            {enableLineNotes && scope.id && onEditLineNote && (
              <LineNoteButton
                hasNote={hasLineNote(scopeNote)}
                label={scopeName}
                onClick={() =>
                  onEditLineNote({
                    targetType: 'combo',
                    targetId: scope.id!,
                    label: scopeName,
                    note: scopeNote,
                  })
                }
              />
            )}
            {onDeleteScope && scope.id && (
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
                    onClick={() => onDeleteScope(scope.id!)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete scope
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </td>
        <LineNotesColumnCell
          show={!!enableLineNotes && !showPricing}
          note={scopeNote}
          className={isEditing ? (isScopeMultiSelected ? 'bg-blue-50/30' : scopeBg) : undefined}
        />
      </tr>

      {isDropActive && (
        <tr>
          <td
            colSpan={20}
            className="bg-violet-50 px-4 py-1.5 text-xs font-medium text-violet-700"
          >
            {dropHint ?? `Release to add catalogue item to "${scopeName}"`}
          </td>
        </tr>
      )}

      {/* Scope children: standalone items + assemblies */}
      {!isCollapsed && (
        <>
          {scopeItems.map((item, idx) => {
            const itemKey = `${scopeKey}-item-${item.id ?? idx}`;
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
                showQuantities={showQuantities}
                showPricing={showPricing}
                showCategory={showCategory}
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
                showSelect={showSelect}
                isPicked={!showSelect || (!!item.id && !!selectedIds?.has(item.id))}
                onTogglePick={() => item.id && onToggleIds?.([item.id])}
                enableLineNotes={enableLineNotes}
                onEditLineNote={onEditLineNote}
              />
            );
          })}
          {scopeCombos.map((combo, comboIdx) => {
            const comboKey = `${scopeKey}-combo-${combo.id ?? comboIdx}`;
            const isComboCollapsed = collapsedCombos.has(comboKey);
            const comboItems = combo.items ?? [];
            const comboItemCount = comboItems.length;
            const resolvedScopeAssembly = resolveChildVisibility
              ? resolveChildVisibility(comboKey, showQuantities ?? true, showPricing ?? true)
              : { showQuantities: showQuantities ?? true, showPricing: showPricing ?? true };
            return (
              <AssemblyBlock
                key={comboKey}
                combo={combo}
                comboKey={comboKey}
                comboItems={comboItems}
                comboItemCount={comboItemCount}
                isCollapsed={isComboCollapsed}
                onToggle={() => onToggleCombo(comboKey)}
                showMarkup={showMarkup}
                showGst={showGst}
                showQuantities={showQuantities}
                showPricing={showPricing}
                showCategory={showCategory}
                editState={editState}
                editInputs={editInputs}
                selectedRows={selectedRows}
                dirtyRowKeys={dirtyRowKeys}
                onItemClick={onItemClick}
                onAssemblyClick={onAssemblyClick}
                onCellSelect={onCellSelect}
                onInputChange={onInputChange}
                onCellKeyDown={onCellKeyDown}
                onDeleteCombo={onDeleteCombo}
                onDeleteItem={onDeleteItem}
                showSelect={showSelect}
                selectedIds={selectedIds}
                onToggleIds={onToggleIds}
                showColumnToggles={showColumnToggles}
                contentShowQuantities={resolvedScopeAssembly.showQuantities}
                contentShowPricing={resolvedScopeAssembly.showPricing}
                isOverridden={isChildOverridden ? isChildOverridden(comboKey) : false}
                onToggleOverride={toggleChildOverride ? () => toggleChildOverride(comboKey, showQuantities ?? true, showPricing ?? true) : undefined}
                onToggleQuantities={toggleChildField ? () => toggleChildField(comboKey, 'showQuantities', resolvedScopeAssembly.showQuantities) : undefined}
                onTogglePricing={toggleChildField ? () => toggleChildField(comboKey, 'showPricing', resolvedScopeAssembly.showPricing) : undefined}
                enableLineNotes={enableLineNotes}
                onEditLineNote={onEditLineNote}
              />
            );
          })}
        </>
      )}
    </>
  );
}

export interface DeleteItemRequest {
  itemId: string;
  itemName?: string;
  isAssemblyChild: boolean;
}

export type LineItemsMode = 'estimate' | 'catalog';

export interface LineItemSelection {
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

export type { GroupDimensions };

export interface QuoteLineItemsTableProps {
  groups: ApiGroup[];
  activeDropKey?: string | null;
  setActiveDropKey?: (key: string | null) => void;
  onCatalogDrop?: (payload: CatalogDragPayload, groupId?: string, quoteComboId?: string) => void;
  onGroupLabelDrop?: (payload: GroupLabelDragPayload) => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onUpdateGroupDimensions?: (groupId: string, dimensions: GroupDimensions) => void;
  onDeleteItem?: (request: DeleteItemRequest) => void;
  onDeleteCombo?: (comboId: string) => void;
  onDeleteScope?: (scopeId: string) => void;
  onMoveGroupUp?: (groupId: string) => void;
  onMoveGroupDown?: (groupId: string) => void;
  onOpenCatalogDrawer?: () => void;
  onSave?: (edits: Record<string, Record<EditableFieldKey, string>>) => void;
  onDirtyChange?: (dirty: boolean, edits: Record<string, Record<EditableFieldKey, string>>) => void;
  /** When true, omit Catalogue/Save from the sticky toolbar (actions live in the layout header). */
  hideToolbarActions?: boolean;
  structurallyDirty?: boolean;
  readOnly?: boolean;
  mode?: LineItemsMode;
  /** When set, rows become pickable (e.g. Create RFQ scope selection). Implies read-only editing. */
  selection?: LineItemSelection;
  /** Compact layout for drawers / embedded panels (no full-page min-height / sticky offset). */
  compact?: boolean;
  /** When true, show Quantities/Pricing toggles on toolbar and per-header. RFQ detail only. */
  showColumnToggles?: boolean;
  /**
   * Controlled Quantities/Pricing column visibility (maps to RFQ includeQuantities / includePricing).
   * When provided with change handlers, toolbar switches become controlled.
   */
  quantitiesVisible?: boolean;
  pricingVisible?: boolean;
  onQuantitiesVisibleChange?: (visible: boolean) => void;
  onPricingVisibleChange?: (visible: boolean) => void;
  /** When true, show per-row notes edit icon and hover preview. RFQ detail view mode only. */
  enableLineNotes?: boolean;
  onEditLineNote?: (request: LineNoteEditRequest) => void;
}

function dimToInput(value?: number): string {
  return value === undefined || value === null || Number.isNaN(value) ? '' : String(value);
}

function parseDimInput(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function GroupDimensionFields({
  groupId,
  length,
  width,
  height,
  disabled,
  onSave,
}: {
  groupId: string;
  length?: number;
  width?: number;
  height?: number;
  disabled?: boolean;
  onSave?: (groupId: string, dimensions: GroupDimensions) => void;
}) {
  const [draft, setDraft] = useState({
    length: dimToInput(length),
    width: dimToInput(width),
    height: dimToInput(height),
  });

  useEffect(() => {
    setDraft({
      length: dimToInput(length),
      width: dimToInput(width),
      height: dimToInput(height),
    });
  }, [groupId, length, width, height]);

  function commit() {
    if (!onSave || disabled) return;
    const next: GroupDimensions = {};
    const parsedLength = parseDimInput(draft.length);
    const parsedWidth = parseDimInput(draft.width);
    const parsedHeight = parseDimInput(draft.height);
    if (parsedLength !== undefined) next.length = parsedLength;
    if (parsedWidth !== undefined) next.width = parsedWidth;
    if (parsedHeight !== undefined) next.height = parsedHeight;

    const same =
      dimToInput(length) === dimToInput(next.length) &&
      dimToInput(width) === dimToInput(next.width) &&
      dimToInput(height) === dimToInput(next.height);
    if (same) return;
    onSave(groupId, next);
  }

  const fields: Array<{ key: 'length' | 'width' | 'height'; label: string; short: string }> = [
    { key: 'length', label: 'Length', short: 'L' },
    { key: 'width', label: 'Width', short: 'W' },
    { key: 'height', label: 'Height', short: 'H' },
  ];

  return (
    <div
      className="ml-8 flex shrink-0 items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {fields.map(({ key, label, short }) => (
        <label
          key={key}
          title={label}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700"
        >
          <span aria-hidden>{short}</span>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            disabled={disabled || !onSave}
            value={draft[key]}
            aria-label={label}
            placeholder="—"
            className="h-8 w-24 border-blue-200 bg-white/80 px-2 text-sm tabular-nums text-blue-950 placeholder:text-blue-300 focus-visible:border-blue-400 focus-visible:ring-blue-400/30"
            onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </label>
      ))}
    </div>
  );
}

function LineItemsColGroup({
  showSelect,
  showCategory,
  showQuantities,
  showPricing,
  showMarkup,
  showGst,
  showNotesColumn,
}: {
  showSelect?: boolean;
  showCategory: boolean;
  showQuantities: boolean;
  showPricing: boolean;
  showMarkup: boolean;
  showGst: boolean;
  showNotesColumn?: boolean;
}) {
  return (
    <colgroup>
      {showSelect && <col className="w-10" />}
      <col className={showCategory ? 'w-[28%]' : 'w-[38%]'} />
      <col className="w-[10%]" />
      {showCategory && <col className="w-[10%]" />}
      {showQuantities && <col className="w-[7%]" />}
      {showQuantities && <col className="w-[6%]" />}
      {showPricing && <col className="w-[9%]" />}
      {showPricing && <col className="w-[10%]" />}
      {showPricing && showMarkup && <col className="w-[8%]" />}
      {showPricing && showGst && <col className="w-[7%]" />}
      {showPricing && <col className="w-[10%]" />}
      <col className="w-10" />
      {showNotesColumn && <col className="w-[16%]" />}
    </colgroup>
  );
}

function LineNotesColumnCell({
  show,
  note,
  className,
}: {
  show: boolean;
  note?: string | null;
  className?: string;
}) {
  if (!show) return null;
  return (
    <td className={cn('max-w-[14rem] px-3 py-2.5 text-left text-xs text-slate-600', className)}>
      {hasLineNote(note) ? (
        <p className="line-clamp-2 whitespace-pre-wrap break-words" title={note ?? undefined}>
          {note}
        </p>
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </td>
  );
}

function HeaderVisibilityToggles({
  isOverridden,
  onToggleOverride,
  showQuantities,
  showPricing,
  onToggleQuantities,
  onTogglePricing,
  colorScheme = 'slate',
}: {
  isOverridden: boolean;
  onToggleOverride: () => void;
  showQuantities: boolean;
  showPricing: boolean;
  onToggleQuantities: () => void;
  onTogglePricing: () => void;
  colorScheme?: 'slate' | 'blue' | 'violet';
}) {
  const labelCls = {
    slate: 'text-slate-600',
    blue: 'text-blue-700',
    violet: 'text-violet-700',
  }[colorScheme];
  return (
    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <label className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide', labelCls)}>
        <Switch checked={isOverridden} onCheckedChange={onToggleOverride} />
        Override
      </label>
      {isOverridden && (
        <>
          <label className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide', labelCls)}>
            <Switch checked={showQuantities} onCheckedChange={onToggleQuantities} />
            Qty
          </label>
          <label className={cn('flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide', labelCls)}>
            <Switch checked={showPricing} onCheckedChange={onTogglePricing} />
            Price
          </label>
        </>
      )}
    </div>
  );
}

function modeLabels(mode: LineItemsMode) {
  if (mode === 'catalog') {
    return {
      groupSingular: 'category',
      groupPlural: 'categories',
      groupSingularCap: 'Category',
      groupPluralCap: 'Categories',
      lineSingular: 'item',
      linePlural: 'items',
      emptyDrop: 'Release anywhere to create a new category',
      emptyState: 'No categories yet. Add a category to get started.',
      addToDrop: (label: string) => `Release to add catalogue item to "${label}"`,
      editGroup: 'Edit category',
      deleteGroup: 'Delete category',
      dragHint: 'Drag catalogue items here to add lines',
    };
  }
  return {
    groupSingular: 'group',
    groupPlural: 'groups',
    groupSingularCap: 'Group',
    groupPluralCap: 'Groups',
    lineSingular: 'line',
    linePlural: 'lines',
    emptyDrop: 'Release anywhere to create a new group',
    emptyState: 'No groups yet. Add a group or drag a group label here.',
    addToDrop: (label: string) => `Release to add catalogue item to "${label}"`,
    editGroup: 'Edit group',
    deleteGroup: 'Delete group',
    dragHint: 'Drag catalogue items here to add lines',
  };
}

export function QuoteLineItemsTable({
  groups: rawGroups,
  activeDropKey,
  setActiveDropKey,
  onCatalogDrop,
  onGroupLabelDrop,
  onEditGroup,
  onDeleteGroup,
  onUpdateGroupDimensions,
  onDeleteItem,
  onDeleteCombo,
  onDeleteScope,
  onMoveGroupUp,
  onMoveGroupDown,
  onOpenCatalogDrawer,
  onSave,
  onDirtyChange,
  hideToolbarActions = false,
  structurallyDirty,
  readOnly,
  mode = 'estimate',
  selection,
  compact,
  showColumnToggles = false,
  quantitiesVisible,
  pricingVisible,
  onQuantitiesVisibleChange,
  onPricingVisibleChange,
  enableLineNotes = false,
  onEditLineNote,
}: QuoteLineItemsTableProps) {
  const groups = useMemo(() => normalizeLineItemGroups(rawGroups), [rawGroups]);
  const labels = modeLabels(mode);
  const showCategory = mode !== 'catalog';
  const showSelect = !!selection;
  const isReadOnly = !!readOnly || showSelect;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedCombos, setCollapsedCombos] = useState<Set<string>>(new Set());
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showMarkup, setShowMarkup] = useState(true);
  const [showGst, setShowGst] = useState(true);
  const [uncontrolledQuantities, setUncontrolledQuantities] = useState(true);
  const [uncontrolledPricing, setUncontrolledPricing] = useState(true);
  const quantitiesControlled = typeof quantitiesVisible === 'boolean' && !!onQuantitiesVisibleChange;
  const pricingControlled = typeof pricingVisible === 'boolean' && !!onPricingVisibleChange;
  const showQuantities = quantitiesControlled ? quantitiesVisible : uncontrolledQuantities;
  const showPricing = pricingControlled ? pricingVisible : uncontrolledPricing;
  const setShowQuantities = quantitiesControlled ? onQuantitiesVisibleChange : setUncontrolledQuantities;
  const setShowPricing = pricingControlled ? onPricingVisibleChange : setUncontrolledPricing;
  const [suppressMarkupIcon, setSuppressMarkupIcon] = useState(false);
  const [suppressGstIcon, setSuppressGstIcon] = useState(false);
  const [headerVisibility, setHeaderVisibility] = useState<
    Record<string, { override?: boolean; showQuantities?: boolean; showPricing?: boolean }>
  >({});
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());
  const [groupFilterOpen, setGroupFilterOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  function resolveVisibility(key: string, parentQty: boolean, parentPrice: boolean) {
    if (!showColumnToggles) return { showQuantities: true, showPricing: true };
    const o = headerVisibility[key];
    if (!o?.override) return { showQuantities: parentQty, showPricing: parentPrice };
    return {
      showQuantities: o.showQuantities ?? parentQty,
      showPricing: o.showPricing ?? parentPrice,
    };
  }

  function isHeaderOverridden(key: string): boolean {
    return !!headerVisibility[key]?.override;
  }

  function toggleHeaderOverride(key: string, parentQty: boolean, parentPrice: boolean) {
    setHeaderVisibility(prev => {
      const cur = prev[key];
      if (cur?.override) {
        return { ...prev, [key]: { override: false } };
      }
      return {
        ...prev,
        [key]: { override: true, showQuantities: parentQty, showPricing: parentPrice },
      };
    });
  }

  function toggleHeaderField(key: string, field: 'showQuantities' | 'showPricing', current: boolean) {
    setHeaderVisibility(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: !current },
    }));
  }

  // Inline edit state
  const [editState, setEditState] = useState<{ rowKey: string; field: EditableFieldKey } | null>(null);
  const [editInputs, setEditInputs] = useState<Record<string, Record<EditableFieldKey, string>>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEditInputs({});
    setEditState(null);
    setSelectedRows(new Set());
  }, [groups]);

  function toggleSelectionIds(ids: string[]) {
    if (!selection || ids.length === 0) return;
    const next = new Set(selection.selectedIds);
    const allSelected = ids.every((id) => next.has(id));
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    selection.onChange(next);
  }

  function groupPickState(group: ApiGroup): boolean | 'indeterminate' {
    if (!selection) return false;
    const ids = collectGroupSelectableIds(group);
    if (ids.length === 0) return false;
    const selectedCount = ids.filter((id) => selection.selectedIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === ids.length) return true;
    return 'indeterminate';
  }

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

  const toggleScope = (scopeKey: string) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeKey)) next.delete(scopeKey);
      else next.add(scopeKey);
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
          (g.combos ?? []).reduce((cs, c) => cs + (c.items?.length ?? 0), 0) +
          (g.scopes ?? []).reduce((ss, s) =>
            ss + (s.items?.length ?? 0) + (s.combos ?? []).reduce((cs, c) => cs + (c.items?.length ?? 0), 0), 0),
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
      for (let si = 0; si < (g.scopes ?? []).length; si++) {
        const scope = g.scopes![si];
        const scopeKey = `${gId}-scope-${scope.id ?? si}`;
        rows.push({ kind: 'scope', key: scopeKey, scope });
        for (let ii = 0; ii < (scope.items ?? []).length; ii++) {
          const item = scope.items![ii];
          rows.push({ kind: 'item', key: `${scopeKey}-item-${item.id ?? ii}`, item });
        }
        for (let ci = 0; ci < (scope.combos ?? []).length; ci++) {
          const combo = scope.combos![ci];
          const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
          rows.push({ kind: 'assembly', key: comboKey, combo });
          for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
            const item = combo.items![ii];
            rows.push({ kind: 'item', key: `${comboKey}-item-${item.id ?? ii}`, item });
          }
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
      } else if (entry.kind === 'scope') {
        const orig = initScopeInputs(entry.scope);
        if (inputs.quantity !== orig.quantity) return true;
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
      const orig = entry.kind === 'item'
        ? initItemInputs(entry.item)
        : entry.kind === 'scope'
          ? initScopeInputs(entry.scope)
          : initComboInputs(entry.combo);
      let changed = false;
      for (const f of Object.keys(orig) as EditableFieldKey[]) {
        if (inputs[f] !== orig[f]) { changed = true; break; }
      }
      if (changed) result[entry.key] = inputs;
    }
    return result;
  }, [editInputs, itemRowIndex]);

  const dirtyRowKeys = useMemo(() => new Set(Object.keys(dirtyEdits)), [dirtyEdits]);

  useEffect(() => {
    onDirtyChange?.(isDirty, dirtyEdits);
  }, [isDirty, dirtyEdits, onDirtyChange]);

  const grandTotals = useMemo(() => {
    let extended = 0;
    let markup = 0;
    let totalTax = 0;

    function addItem(item: ApiItem, rowKey: string) {
      const inputs = editInputs[rowKey];
      const qty = inputs ? parseFloat(inputs.quantity) || 0 : (item.quantity ?? 0);
      const uc = inputs ? parseFloat(inputs.unitCost) || 0 : (item.unitCost ?? 0);
      const cost = uc * qty;
      extended += cost;
      const mkVal = inputs ? parseFloat(inputs.markupValue) || 0 : (item.markupValue ?? 19);
      const mkAmt = item.markupType === 'fixed' ? mkVal * qty : cost * (mkVal / 100);
      markup += mkAmt;
      const taxPct = inputs
        ? parseFloat(inputs.tax) || 0
        : (item.tax ?? 0);
      totalTax += (cost + mkAmt) * (taxPct / 100);
    }

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const gId = g.id ?? `group-${gi}`;
      for (let ii = 0; ii < (g.items ?? []).length; ii++) {
        const item = g.items![ii];
        addItem(item, `${gId}-item-${item.id ?? ii}`);
      }
      for (let ci = 0; ci < (g.combos ?? []).length; ci++) {
        const combo = g.combos![ci];
        const comboKey = `${gId}-combo-${combo.id ?? ci}`;
        for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
          const item = combo.items![ii];
          addItem(item, `${comboKey}-item-${item.id ?? ii}`);
        }
      }
      for (let si = 0; si < (g.scopes ?? []).length; si++) {
        const scope = g.scopes![si];
        const scopeKey = `${gId}-scope-${scope.id ?? si}`;
        for (let ii = 0; ii < (scope.items ?? []).length; ii++) {
          const item = scope.items![ii];
          addItem(item, `${scopeKey}-item-${item.id ?? ii}`);
        }
        for (let ci = 0; ci < (scope.combos ?? []).length; ci++) {
          const combo = scope.combos![ci];
          const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
          for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
            const item = combo.items![ii];
            addItem(item, `${comboKey}-item-${item.id ?? ii}`);
          }
        }
      }
    }

    const subTotal = extended + (showMarkup ? markup : 0) + (showGst ? totalTax : 0);
    const total = extended + markup + totalTax;
    return { subTotal, markup, totalTax, total };
  }, [groups, showMarkup, showGst, editInputs]);

  /* ---- Inline-edit handlers ---- */

  function handleItemClick(e: React.MouseEvent, rowKey: string, item: ApiItem) {
    if (isReadOnly) return;
    const td = (e.target as HTMLElement).closest('td');
    const col = (td?.dataset.col as ColumnKey) ?? null;
    const field = col ? nearestEditableField(col, showMarkup, showGst, showQuantities, showPricing) : 'name';

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
    if (isReadOnly) return;
    const target = e.target as HTMLElement;
    const fieldEl = target.closest('[data-assembly-field]');
    const assemblyField = fieldEl?.getAttribute('data-assembly-field');
    const field: EditableFieldKey =
      assemblyField === 'quantity' && showQuantities ? 'quantity' : 'name';

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

  function handleScopeClick(e: React.MouseEvent, rowKey: string, scope: ApiScope) {
    if (isReadOnly) return;
    const target = e.target as HTMLElement;
    const fieldEl = target.closest('[data-scope-field]');
    const scopeField = fieldEl?.getAttribute('data-scope-field');
    const field: EditableFieldKey =
      scopeField === 'quantity' && showQuantities ? 'quantity' : 'name';

    setEditInputs((prev) => {
      if (prev[rowKey]) return prev;
      return { ...prev, [rowKey]: initScopeInputs(scope) };
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
    if (isReadOnly) return;
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
    const assemblyFields = showQuantities
      ? ASSEMBLY_EDITABLE_FIELDS
      : ASSEMBLY_EDITABLE_FIELDS.filter((f) => f !== 'quantity');
    const scopeFields = showQuantities
      ? SCOPE_EDITABLE_FIELDS
      : SCOPE_EDITABLE_FIELDS.filter((f) => f !== 'quantity');
    let effectiveField = field;
    if (target.kind === 'assembly') {
      effectiveField = assemblyFields.includes(field) ? field : 'name';
    } else if (target.kind === 'scope') {
      effectiveField = scopeFields.includes(field) ? field : 'name';
    }
    setEditInputs((prev) => {
      if (prev[target.key]) return prev;
      const inputs = target.kind === 'assembly'
        ? initComboInputs(target.combo)
        : target.kind === 'scope'
          ? initScopeInputs(target.scope)
          : initItemInputs(target.item);
      return { ...prev, [target.key]: inputs };
    });
    setEditState({ rowKey: target.key, field: effectiveField });
  }

  function handleCellKeyDown(e: React.KeyboardEvent) {
    if (!editState) return;
    const currentRow = visibleRowIndex.find((r) => r.key === editState.rowKey);
    const assemblyFields = showQuantities
      ? ASSEMBLY_EDITABLE_FIELDS
      : ASSEMBLY_EDITABLE_FIELDS.filter((f) => f !== 'quantity');
    const scopeFields = showQuantities
      ? SCOPE_EDITABLE_FIELDS
      : SCOPE_EDITABLE_FIELDS.filter((f) => f !== 'quantity');
    const fields = currentRow?.kind === 'assembly'
      ? assemblyFields
      : currentRow?.kind === 'scope'
        ? scopeFields
        : getEditableFields(showMarkup, showGst, showQuantities, showPricing);
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
          const nextField = fields.find((f) => !NAME_COL_FIELDS.includes(f));
          if (nextField) setEditState({ ...editState, field: nextField });
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

    const matchesItem = (item: ApiItem) => {
      const category = [item.category, item.subCategory].filter(Boolean).join(' / ');
      return (
        (item.name ?? '').toLowerCase().includes(term) ||
        (item.component ?? '').toLowerCase().includes(term) ||
        (item.type ?? '').toLowerCase().includes(term) ||
        category.toLowerCase().includes(term)
      );
    };

    const matchesCombo = (combo: ApiCombo) => {
      const category = [combo.category, combo.subCategory].filter(Boolean).join(' / ');
      return (
        (combo.name ?? '').toLowerCase().includes(term) ||
        (combo.component ?? '').toLowerCase().includes(term) ||
        'assembly'.includes(term) ||
        category.toLowerCase().includes(term)
      );
    };

    const matchesScope = (scope: ApiScope) => {
      const category = [scope.category, scope.subCategory].filter(Boolean).join(' / ');
      return (
        (scope.name ?? '').toLowerCase().includes(term) ||
        (scope.component ?? '').toLowerCase().includes(term) ||
        'scope'.includes(term) ||
        category.toLowerCase().includes(term)
      );
    };

    return result
      .map((group) => {
        const filteredItems = (group.items ?? []).filter(matchesItem);
        const filteredCombos = (group.combos ?? [])
          .map((combo) => {
            const comboMatch = matchesCombo(combo);
            const matchingItems = (combo.items ?? []).filter(matchesItem);
            if (comboMatch || matchingItems.length > 0) {
              return { ...combo, items: comboMatch ? combo.items : matchingItems };
            }
            return null;
          })
          .filter(Boolean) as typeof group.combos;
        const filteredScopes = (group.scopes ?? [])
          .map((scope) => {
            const scopeMatch = matchesScope(scope);
            const matchingItems = (scope.items ?? []).filter(matchesItem);
            const matchingCombos = (scope.combos ?? [])
              .map((combo) => {
                const comboMatch = matchesCombo(combo);
                const comboMatchingItems = (combo.items ?? []).filter(matchesItem);
                if (comboMatch || comboMatchingItems.length > 0) {
                  return { ...combo, items: comboMatch ? combo.items : comboMatchingItems };
                }
                return null;
              })
              .filter(Boolean) as ApiCombo[];
            if (scopeMatch || matchingItems.length > 0 || matchingCombos.length > 0) {
              return {
                ...scope,
                items: scopeMatch ? scope.items : matchingItems,
                combos: scopeMatch ? scope.combos : matchingCombos,
              };
            }
            return null;
          })
          .filter(Boolean) as typeof group.scopes;
        if (filteredItems.length > 0 || (filteredCombos && filteredCombos.length > 0) || (filteredScopes && filteredScopes.length > 0)) {
          return { ...group, items: filteredItems, combos: filteredCombos, scopes: filteredScopes };
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
      for (let si = 0; si < (g.scopes ?? []).length; si++) {
        const scope = g.scopes![si];
        const scopeKey = `${gId}-scope-${scope.id ?? si}`;
        rows.push({ kind: 'scope', key: scopeKey, scope });
        for (let ii = 0; ii < (scope.items ?? []).length; ii++) {
          const item = scope.items![ii];
          rows.push({ kind: 'item', key: `${scopeKey}-item-${item.id ?? ii}`, item });
        }
        for (let ci = 0; ci < (scope.combos ?? []).length; ci++) {
          const combo = scope.combos![ci];
          const comboKey = `${scopeKey}-combo-${combo.id ?? ci}`;
          rows.push({ kind: 'assembly', key: comboKey, combo });
          for (let ii = 0; ii < (combo.items ?? []).length; ii++) {
            const item = combo.items![ii];
            rows.push({ kind: 'item', key: `${comboKey}-item-${item.id ?? ii}`, item });
          }
        }
      }
    }
    return rows;
  }, [filteredGroups]);

  const tableDropProps = isReadOnly ? {} : {
    onDragOver: (e: React.DragEvent) => {
      if (!hasGroupLabelDrag(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setActiveDropKey?.('table-root');
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (activeDropKey === 'table-root') setActiveDropKey?.(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setActiveDropKey?.(null);
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
        {!hideToolbarActions && onOpenCatalogDrawer && (
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
            'flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed text-sm text-slate-500 transition-all',
            activeDropKey === 'table-root'
              ? 'border-emerald-400 bg-emerald-50/40'
              : 'border-slate-200',
          )}
        >
          <p>
            {activeDropKey === 'table-root'
              ? labels.emptyDrop
              : labels.emptyState}
          </p>
          {onOpenCatalogDrawer && activeDropKey !== 'table-root' && (
            <Button size="sm" variant="outline" onClick={onOpenCatalogDrawer}>
              <Package className="mr-1.5 h-4 w-4" />
              Open catalogue
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border-2 border-dashed p-1 transition-all',
        !compact && 'min-h-[calc(100vh-12rem)]',
        activeDropKey === 'table-root'
          ? 'border-emerald-400 bg-emerald-50/30 ring-2 ring-emerald-500/30'
          : 'border-transparent',
      )}
      {...tableDropProps}
    >
      <div
        data-slot="quote-line-items-toolbar"
        className={cn(
          'sticky z-[9] flex cursor-pointer items-center justify-between rounded-lg border-2 border-slate-400 bg-slate-100 px-5 py-4 shadow-md transition-colors hover:bg-slate-200',
          'top-0',
        )}
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
                    title={groupFilterActive ? `${labels.groupSingularCap} filter active` : `Filter ${labels.groupPlural}`}
                >
                  <span className="text-sm font-semibold text-slate-800">
                    {groups.length} {groups.length !== 1 ? labels.groupPlural : labels.groupSingular} &middot; {totalItems} {totalItems !== 1 ? labels.linePlural : labels.lineSingular}
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
                  <span className="text-xs font-medium text-muted-foreground">Filter {labels.groupPlural}</span>
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
                  const label = groupLabel(g, i, labels.groupSingularCap);
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
          {mode !== 'catalog' && (
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
          )}
          {!hideToolbarActions && onOpenCatalogDrawer && (
            <Button size="sm" variant="outline" onClick={onOpenCatalogDrawer} title="Open catalogue">
              <Package className="h-4 w-4" />
            </Button>
          )}
          {!hideToolbarActions && onSave && mode !== 'catalog' && (
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
          {showColumnToggles && (
            <div className="flex items-center gap-4 border-l border-slate-300 pl-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="line-items-show-quantities"
                  checked={showQuantities}
                  onCheckedChange={setShowQuantities}
                  aria-label="Show quantities"
                />
                <Label htmlFor="line-items-show-quantities" className="cursor-pointer text-xs font-medium text-slate-700">
                  Quantities
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="line-items-show-pricing"
                  checked={showPricing}
                  onCheckedChange={setShowPricing}
                  aria-label="Show pricing"
                />
                <Label htmlFor="line-items-show-pricing" className="cursor-pointer text-xs font-medium text-slate-700">
                  Pricing
                </Label>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
          {(showColumnToggles ? showPricing : true) && (
            <>
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
            </>
          )}
        </div>
      </div>

      {activeDropKey === 'table-root' && (
        <div className="rounded-lg bg-emerald-100/80 px-4 py-2.5 text-center text-xs font-medium text-emerald-700">
          {labels.emptyDrop}
        </div>
      )}

      {searchTerm && filteredGroups.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-sm text-slate-400">
          No line items match &ldquo;{searchTerm}&rdquo;
        </div>
      )}

      {filteredGroups.map((group, groupIndex) => {
        const gId = group.id ?? `group-${groupIndex}`;
        const label = groupLabel(group, groupIndex, labels.groupSingularCap);
        const isCollapsed = searchTerm ? false : collapsed.has(gId);
        const dropKey = `group-drop-${gId}`;
        const isDropActive = activeDropKey === dropKey;

        const standaloneItems = group.items ?? [];
        const combos = group.combos ?? [];
        const scopes = group.scopes ?? [];

        const resolvedGroup = resolveVisibility(gId, showQuantities, showPricing);

        function computeItemTotal(item: ApiItem, rowKey: string): number {
          const inputs = editInputs[rowKey];
          const qty = inputs ? parseFloat(inputs.quantity) || 0 : (item.quantity ?? 0);
          const uc = inputs ? parseFloat(inputs.unitCost) || 0 : (item.unitCost ?? 0);
          const ext = qty * uc;
          const mkVal = inputs ? parseFloat(inputs.markupValue) || 0 : (item.markupValue ?? 19);
          const mkAmt = item.markupType === 'fixed' ? mkVal * qty : ext * (mkVal / 100);
          const taxPct = inputs
            ? parseFloat(inputs.tax) || 0
            : (item.tax ?? 0);
          const gstAmt = (ext + mkAmt) * (taxPct / 100);
          return ext + (showMarkup ? mkAmt : 0) + (showGst ? gstAmt : 0);
        }

        const standaloneTotal = standaloneItems.reduce((sum, it, idx) =>
          sum + computeItemTotal(it, `${gId}-item-${it.id ?? idx}`), 0);
        const comboTotalSum = combos.reduce((sum, c, ci) =>
          sum + (c.items ?? []).reduce((s, it, ii) =>
            s + computeItemTotal(it, `${gId}-combo-${c.id ?? ci}-item-${it.id ?? ii}`), 0), 0);
        const scopeTotalSum = scopes.reduce((sum, scope, si) => {
          const scopeKey = `${gId}-scope-${scope.id ?? si}`;
          const scopeItemSum = (scope.items ?? []).reduce((s, it, ii) =>
            s + computeItemTotal(it, `${scopeKey}-item-${it.id ?? ii}`), 0);
          const scopeComboSum = (scope.combos ?? []).reduce((s, c, ci) =>
            s + (c.items ?? []).reduce((cs, it, ii) =>
              cs + computeItemTotal(it, `${scopeKey}-combo-${c.id ?? ci}-item-${it.id ?? ii}`), 0), 0);
          return sum + scopeItemSum + scopeComboSum;
        }, 0);
        const groupTotal = standaloneTotal + comboTotalSum + scopeTotalSum;
        const totalLineCount =
          standaloneItems.length +
          combos.reduce((cs, c) => cs + (c.items?.length ?? 0), 0) +
          scopes.reduce((ss, s) => ss + (s.items?.length ?? 0) + (s.combos ?? []).reduce((cs, c) => cs + (c.items?.length ?? 0), 0), 0);
        const hasTopLevelRows = standaloneItems.length > 0 || combos.length > 0;
        const hasRows = hasTopLevelRows || scopes.length > 0;

        const dropProps = isReadOnly ? {} : {
          onDragOver: (e: React.DragEvent) => {
            if (hasGroupLabelDrag(e.dataTransfer)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            setActiveDropKey?.(dropKey);
          },
          onDragLeave: (e: React.DragEvent) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            if (activeDropKey === dropKey) setActiveDropKey?.(null);
          },
          onDrop: (e: React.DragEvent) => {
            if (hasGroupLabelDrag(e.dataTransfer)) return;
            e.preventDefault();
            setActiveDropKey?.(null);
            const payload = getCatalogDragData(e.dataTransfer);
            if (!payload) return;
            onCatalogDrop?.(payload, group.id);
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
            <GroupNoteHoverBar
              note={group.note}
              enabled={enableLineNotes}
              className={cn(
                'relative flex cursor-pointer items-center gap-2 bg-blue-100 px-4 py-3 transition-colors hover:bg-blue-200',
                selectedKey === `group-${gId}` && 'ring-2 ring-inset ring-amber-300 bg-amber-50/60',
              )}
              onClick={() => {
                setSelectedKey(selectedKey === `group-${gId}` ? null : `group-${gId}`);
                toggleCollapse(gId);
              }}
            >
              {showSelect && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={groupPickState(group) === true}
                    indeterminate={groupPickState(group) === 'indeterminate'}
                    onCheckedChange={() => toggleSelectionIds(collectGroupSelectableIds(group))}
                    aria-label={`Select all items in ${label}`}
                  />
                </span>
              )}
              <span className="flex items-center text-blue-600">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>

              <GripVertical className="h-4 w-4 text-blue-400" />

              <div className="flex min-w-0 flex-1 items-center">
                <span className="truncate text-sm font-semibold text-blue-950">{label}</span>
                {group.description && label !== group.description && (
                  <span className="ml-2 truncate text-xs text-blue-700">{group.description}</span>
                )}
                {mode !== 'catalog' && group.id && (
                  <GroupDimensionFields
                    groupId={group.id}
                    length={group.length}
                    width={group.width}
                    height={group.height}
                    disabled={isReadOnly}
                    onSave={onUpdateGroupDimensions}
                  />
                )}
              </div>

              <span className="text-xs tabular-nums text-blue-700">
                {totalLineCount} item{totalLineCount !== 1 ? 's' : ''}
                {scopes.length > 0 && ` · ${scopes.length} scope${scopes.length !== 1 ? 's' : ''}`}
                {combos.length > 0 && ` · ${combos.length} assembl${combos.length !== 1 ? 'ies' : 'y'}`}
              </span>
              {showColumnToggles && (
                <div className="absolute left-3/4 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                  <HeaderVisibilityToggles
                    isOverridden={isHeaderOverridden(gId)}
                    onToggleOverride={() => toggleHeaderOverride(gId, showQuantities, showPricing)}
                    showQuantities={resolvedGroup.showQuantities}
                    showPricing={resolvedGroup.showPricing}
                    onToggleQuantities={() => toggleHeaderField(gId, 'showQuantities', resolvedGroup.showQuantities)}
                    onTogglePricing={() => toggleHeaderField(gId, 'showPricing', resolvedGroup.showPricing)}
                    colorScheme="blue"
                  />
                </div>
              )}
              {(showColumnToggles ? resolvedGroup.showPricing : showPricing) && (
                <span className="text-sm font-medium tabular-nums text-blue-900">
                  {formatCurrency(groupTotal)}
                </span>
              )}

              {enableLineNotes && group.id && onEditLineNote && (
                <LineNoteButton
                  hasNote={hasLineNote(group.note)}
                  label={label}
                  onClick={() =>
                    onEditLineNote({
                      targetType: 'group',
                      targetId: group.id!,
                      label,
                      note: group.note,
                    })
                  }
                />
              )}

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
                        {labels.editGroup}
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
                        {labels.deleteGroup}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </GroupNoteHoverBar>

            {/* Drop indicator */}
            {isDropActive && (
              <div className="bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700">
                {labels.addToDrop(label)}
              </div>
            )}

            {/* Group body - items table */}
            {!isCollapsed && (
              <div className="bg-white">
                {hasRows ? (
                  <div>
                  {hasTopLevelRows && (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed divide-y divide-slate-100 text-sm">
                      <LineItemsColGroup
                        showSelect={showSelect}
                        showCategory={showCategory}
                        showQuantities={resolvedGroup.showQuantities}
                        showPricing={resolvedGroup.showPricing}
                        showMarkup={showMarkup}
                        showGst={showGst}
                        showNotesColumn={enableLineNotes && !resolvedGroup.showPricing}
                      />
                      <thead className="bg-slate-50/50">
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                          {showSelect && <th scope="col" className="w-10 px-3 py-2" />}
                          <th scope="col" className="px-4 py-2">Name</th>
                          <th scope="col" className="px-4 py-2">Type</th>
                          {showCategory && <th scope="col" className="px-4 py-2">Category</th>}
                          {resolvedGroup.showQuantities && <th scope="col" className="px-4 py-2 text-right">Qty</th>}
                          {resolvedGroup.showQuantities && <th scope="col" className="px-4 py-2">Unit</th>}
                          {resolvedGroup.showPricing && <th scope="col" className="px-4 py-2 text-right">Unit Price</th>}
                          {resolvedGroup.showPricing && <th scope="col" className="px-4 py-2 text-right">Extended</th>}
                          {resolvedGroup.showPricing && showMarkup && <th scope="col" className="px-4 py-2 text-right">Markup</th>}
                          {resolvedGroup.showPricing && showGst && <th scope="col" className="px-4 py-2 text-right">GST</th>}
                          {resolvedGroup.showPricing && <th scope="col" className="px-4 py-2 text-right">Total</th>}
                          <th scope="col" className="w-10" />
                          {enableLineNotes && !resolvedGroup.showPricing && (
                            <th scope="col" className="px-3 py-2">Notes</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {/* Standalone items */}
                        {standaloneItems.map((item, idx) => {
                          const itemKey = `${gId}-item-${item.id ?? idx}`;
                          const itemEditing = !isReadOnly && (editState?.rowKey === itemKey || (selectedRows.has(itemKey) && editState !== null));
                          const itemPrimary = editState?.rowKey === itemKey;
                          return (
                            <ItemRow
                              key={itemKey}
                              item={item}
                              rowKey={itemKey}
                              showMarkup={showMarkup}
                              showGst={showGst}
                              showQuantities={resolvedGroup.showQuantities}
                              showPricing={resolvedGroup.showPricing}
                              showCategory={showCategory}
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
                              onDelete={isReadOnly ? undefined : onDeleteItem}
                              showSelect={showSelect}
                              isPicked={!showSelect || (!!item.id && selection!.selectedIds.has(item.id))}
                              onTogglePick={() => item.id && toggleSelectionIds([item.id])}
                              enableLineNotes={enableLineNotes}
                              onEditLineNote={onEditLineNote}
                            />
                          );
                        })}

                        {/* Assembly (combo) groups */}
                        {combos.map((combo, comboIdx) => {
                          const comboKey = `${gId}-combo-${combo.id ?? comboIdx}`;
                          const isComboCollapsed = searchTerm ? false : collapsedCombos.has(comboKey);
                          const comboItems = combo.items ?? [];
                          const comboItemCount = comboItems.length;
                          const resolvedAssembly = resolveVisibility(comboKey, resolvedGroup.showQuantities, resolvedGroup.showPricing);

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
                              showQuantities={resolvedGroup.showQuantities}
                              showPricing={resolvedGroup.showPricing}
                              showCategory={showCategory}
                              editState={isReadOnly ? null : editState}
                              editInputs={editInputs}
                              selectedRows={selectedRows}
                              dirtyRowKeys={dirtyRowKeys}
                              onItemClick={handleItemClick}
                              onAssemblyClick={handleAssemblyClick}
                              onCellSelect={handleCellSelect}
                              onInputChange={handleInputChange}
                              onCellKeyDown={handleCellKeyDown}
                              onDeleteCombo={isReadOnly ? undefined : onDeleteCombo}
                              onDeleteItem={isReadOnly ? undefined : onDeleteItem}
                              showSelect={showSelect}
                              selectedIds={selection?.selectedIds}
                              onToggleIds={toggleSelectionIds}
                              showColumnToggles={showColumnToggles}
                              contentShowQuantities={resolvedAssembly.showQuantities}
                              contentShowPricing={resolvedAssembly.showPricing}
                              isOverridden={isHeaderOverridden(comboKey)}
                              onToggleOverride={() => toggleHeaderOverride(comboKey, resolvedGroup.showQuantities, resolvedGroup.showPricing)}
                              onToggleQuantities={() => toggleHeaderField(comboKey, 'showQuantities', resolvedAssembly.showQuantities)}
                              onTogglePricing={() => toggleHeaderField(comboKey, 'showPricing', resolvedAssembly.showPricing)}
                              enableLineNotes={enableLineNotes}
                              onEditLineNote={onEditLineNote}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}

                  {scopes.length > 0 && (
                    <div className={cn('space-y-2 px-3 pb-3', hasTopLevelRows ? 'pt-2' : 'pt-3')}>
                      {scopes.map((scope, scopeIdx) => {
                          const scopeKey = `${gId}-scope-${scope.id ?? scopeIdx}`;
                          const isScopeCollapsed = searchTerm ? false : collapsedScopes.has(scopeKey);
                          const resolvedScope = resolveVisibility(scopeKey, resolvedGroup.showQuantities, resolvedGroup.showPricing);
                          const scopeDropKey = `scope-drop-${scope.id ?? scopeKey}`;
                          const isScopeDropActive = activeDropKey === scopeDropKey;
                          const scopeDropProps =
                            isReadOnly || !onCatalogDrop || !scope.id
                              ? {}
                              : {
                                  onDragOver: (e: React.DragEvent) => {
                                    if (hasGroupLabelDrag(e.dataTransfer)) return;
                                    if (!hasCatalogDrag(e.dataTransfer) && !e.dataTransfer.types.includes('text/plain')) {
                                      return;
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = 'copy';
                                    setActiveDropKey?.(scopeDropKey);
                                  },
                                  onDragLeave: (e: React.DragEvent) => {
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    if (activeDropKey === scopeDropKey) setActiveDropKey?.(null);
                                  },
                                  onDrop: (e: React.DragEvent) => {
                                    if (hasGroupLabelDrag(e.dataTransfer)) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveDropKey?.(null);
                                    const payload = getCatalogDragData(e.dataTransfer);
                                    if (!payload) return;
                                    if (isScopeCollapsed) toggleScope(scopeKey);
                                    onCatalogDrop(payload, group.id, scope.id);
                                  },
                                };

                          return (
                            <div
                              key={scopeKey}
                              {...scopeDropProps}
                              className={cn(
                                'overflow-hidden rounded-lg border shadow-sm transition-all',
                                isScopeDropActive
                                  ? 'border-violet-400 ring-2 ring-violet-500/30'
                                  : 'border-violet-200',
                              )}
                            >
                              <table className="w-full table-fixed divide-y divide-slate-100 text-sm">
                                <LineItemsColGroup
                                  showSelect={showSelect}
                                  showCategory={showCategory}
                                  showQuantities={resolvedScope.showQuantities}
                                  showPricing={resolvedScope.showPricing}
                                  showMarkup={showMarkup}
                                  showGst={showGst}
                                  showNotesColumn={enableLineNotes && !resolvedScope.showPricing}
                                />
                                <tbody className="divide-y divide-slate-50">
                                  <ScopeBlock
                                    scope={scope}
                                    scopeKey={scopeKey}
                                    isCollapsed={isScopeCollapsed}
                                    onToggle={() => toggleScope(scopeKey)}
                                    showMarkup={showMarkup}
                                    showGst={showGst}
                                    showQuantities={resolvedScope.showQuantities}
                                    showPricing={resolvedScope.showPricing}
                                    showCategory={showCategory}
                                    editState={isReadOnly ? null : editState}
                                    editInputs={editInputs}
                                    selectedRows={selectedRows}
                                    dirtyRowKeys={dirtyRowKeys}
                                    collapsedCombos={collapsedCombos}
                                    onToggleCombo={toggleCombo}
                                    onItemClick={handleItemClick}
                                    onAssemblyClick={handleAssemblyClick}
                                    onScopeClick={handleScopeClick}
                                    onCellSelect={handleCellSelect}
                                    onInputChange={handleInputChange}
                                    onCellKeyDown={handleCellKeyDown}
                                    onDeleteScope={isReadOnly ? undefined : onDeleteScope}
                                    onDeleteCombo={isReadOnly ? undefined : onDeleteCombo}
                                    onDeleteItem={isReadOnly ? undefined : onDeleteItem}
                                    showSelect={showSelect}
                                    selectedIds={selection?.selectedIds}
                                    onToggleIds={toggleSelectionIds}
                                    isDropActive={isScopeDropActive}
                                    dropHint={labels.addToDrop(scope.name ?? 'Scope')}
                                    showColumnToggles={showColumnToggles}
                                    isOverridden={isHeaderOverridden(scopeKey)}
                                    onToggleOverride={() => toggleHeaderOverride(scopeKey, resolvedGroup.showQuantities, resolvedGroup.showPricing)}
                                    onToggleQuantities={() => toggleHeaderField(scopeKey, 'showQuantities', resolvedScope.showQuantities)}
                                    onTogglePricing={() => toggleHeaderField(scopeKey, 'showPricing', resolvedScope.showPricing)}
                                    resolveChildVisibility={resolveVisibility}
                                    toggleChildField={toggleHeaderField}
                                    isChildOverridden={isHeaderOverridden}
                                    toggleChildOverride={toggleHeaderOverride}
                                    enableLineNotes={enableLineNotes}
                                    onEditLineNote={onEditLineNote}
                                  />
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-slate-400">
                    {labels.dragHint}
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

function collectGroupSelectableIds(group: ApiGroup): string[] {
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
