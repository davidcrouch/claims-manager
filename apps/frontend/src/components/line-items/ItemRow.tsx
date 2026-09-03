'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, StickyNote, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/components/shared/detail';
import { isFixedMarkupType, storedMarkupToUi, storedTaxToUi } from '@/lib/rates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLineItems } from './LineItemsProvider';
import { useDropIndicatorBorder } from './DropIndicatorLine';
import { useDropTargetHighlight } from './lib/drop-highlight';
import { RowLeadCheckbox, RowLeadDrag, ROW_LEAD_TD_CHECK, ROW_LEAD_TD_CHECK_LEAD, ROW_LEAD_TD_DRAG } from './lib/row-lead';
import { useLineDetailHover } from './lib/line-detail-hover';
import {
  LI_TD_ACTIONS,
  LI_TD_CELL,
  LI_TD_CELL_RIGHT,
  LI_TD_MONEY,
  LI_TD_MONEY_INPUT,
  LI_TD_NOTES,
} from './lib/table-parts';
import { computeItemMoney, initItemInputs, nearestEditableField, UNIT_TYPE_OPTIONS } from './lib/money';
import { LineScopeStatusBadge, PublishStatusBadge } from './lib/badges';
import { LineScopeStatusField } from './LineScopeStatusField';
import type { ApiItem, ColumnKey, DeleteItemRequest, EditableFieldKey } from './lib/types';

interface ItemRowProps {
  item: ApiItem;
  rowKey: string;
  indented?: boolean;
  parentShowQuantities?: boolean;
  parentShowPricing?: boolean;
  contentDisabled?: { quantities?: boolean; pricing?: boolean };
}

export const ItemRow = memo(function ItemRow({
  item,
  rowKey,
  indented = false,
  parentShowQuantities,
  parentShowPricing,
  contentDisabled,
}: ItemRowProps) {
  const {
    config,
    isReadOnly,
    editState,
    editInputs,
    selectedRows,
    dirtyRowKeys,
    selection,
    bulkSelectedIds,
    actions,
    setEditState,
    setEditInputs,
    handleInputChange,
    handleCellKeyDown,
    handleBulkToggle,
  } = useLineItems();

  const { showMarkup, showGst, enableLineNotes, pricingDetail, showInvoiceProgress, invoiceProgressEditable } = config;
  const hideComponent = config.hideComponent;
  const showQuantities = parentShowQuantities ?? config.showQuantities;
  const showPricing = parentShowPricing ?? config.showPricing;
  const showPriceBreakdown = showPricing && pricingDetail !== 'total-only';
  const showMarkupCol = showPriceBreakdown && showMarkup;
  const showGstCol = showPriceBreakdown && showGst;
  const showCategory = config.showCategory;
  const showSelect = !!selection;
  const showBulkSelect = !isReadOnly && !showSelect;
  const showDragHandle = !isReadOnly && !!actions.onReorderLineItems;
  const qtyDisabled = contentDisabled?.quantities ?? false;
  const priceDisabled = contentDisabled?.pricing ?? false;
  /** Invoice-only edit mode: other fields stay display-only even when mode is edit. */
  const invoiceOnlyEdit = invoiceProgressEditable && showInvoiceProgress;
  const canStartEdit = !isReadOnly || invoiceOnlyEdit;

  const isEditing = editState?.rowKey === rowKey || (selectedRows.has(rowKey) && editState !== null);
  const isPrimaryEdit = editState?.rowKey === rowKey;
  const selectedField = editState?.rowKey === rowKey ? editState.field : null;
  const inputs = editInputs[rowKey] ?? null;
  /** Show inline inputs for normal fields (not in invoice-only edit mode). */
  const showNormalInputs = isEditing && !!inputs && !invoiceOnlyEdit;
  const isDirtyRow = dirtyRowKeys.has(rowKey);
  const isMultiSelected = selectedRows.size > 1 && selectedRows.has(rowKey);
  const isPicked = !showSelect || (!!item.id && !!selection?.selectedIds.has(item.id));
  const isBulkSelected = !!item.id && bulkSelectedIds.has(item.id);

  // dnd-kit sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowKey, disabled: !showDragHandle });

  const indicatorBorder = useDropIndicatorBorder(rowKey);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    ...indicatorBorder,
  };

  // Computed money
  const money = useMemo(
    () => computeItemMoney(item, inputs ?? undefined, showMarkup, showGst),
    [item, inputs, showMarkup, showGst],
  );

  // Auto-focus on edit
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    if (isEditing && selectedField && isPrimaryEdit) {
      const el = inputRefs.current[selectedField];
      if (el) {
        el.focus();
        if ('select' in el && typeof el.select === 'function') el.select();
      }
    }
  }, [isEditing, selectedField, isPrimaryEdit]);

  const handleRowClick = (e: React.MouseEvent) => {
    if (!canStartEdit) return;
    if (showSelect) {
      if (item.id) selection?.onChange(toggleId(selection.selectedIds, item.id));
      return;
    }
    const td = (e.target as HTMLElement).closest('td');
    const col = (td?.dataset.col as ColumnKey) ?? null;

    if (invoiceOnlyEdit) {
      if (col !== 'invoiced') return;
      setEditInputs((prev) => {
        if (prev[rowKey]) return prev;
        return { ...prev, [rowKey]: initItemInputs(item) };
      });
      setEditState({ rowKey, field: 'invoiced' });
      return;
    }

    const field = col
      ? nearestEditableField(col, showMarkup, showGst, showQuantities, showPricing, hideComponent, false)
      : 'name';

    setEditInputs((prev) => {
      if (prev[rowKey]) return prev;
      return { ...prev, [rowKey]: initItemInputs(item) };
    });

    if (e.ctrlKey || e.metaKey) {
      // Multi-select
    } else {
      setEditState({ rowKey, field });
    }
  };

  const cellClick = (field: EditableFieldKey) => (e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      setEditState({ rowKey, field });
    }
  };

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
      : cn('whitespace-nowrap hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]', LI_TD_CELL);

  const editMoneyCellCls = (field: EditableFieldKey) =>
    isEditing
      ? cn(
          'whitespace-nowrap p-0 transition-shadow',
          selectedField === field
            ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
            : isMultiSelected
              ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
              : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40',
        )
      : cn('whitespace-nowrap hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]', LI_TD_MONEY);

  const editRightCellCls = (field: EditableFieldKey) =>
    isEditing
      ? cn(
          'whitespace-nowrap p-0 transition-shadow',
          selectedField === field
            ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
            : isMultiSelected
              ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
              : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40',
        )
      : cn('whitespace-nowrap hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]', LI_TD_CELL_RIGHT);

  const inputCls = (align: 'left' | 'right' = 'right') =>
    cn(
      'w-full bg-transparent outline-none',
      align === 'right' ? cn(LI_TD_CELL_RIGHT, 'font-mono text-slate-700') : cn(LI_TD_CELL, 'font-medium text-slate-900'),
    );

  const nameColTdCls = isEditing
    ? cn(
        'p-0 transition-shadow min-w-0',
        isMultiSelected
          ? 'shadow-[inset_0_0_0_1px_#93c5fd33] bg-blue-50/30'
          : 'shadow-[inset_0_0_0_1px_#d4a84733] bg-amber-50/40',
      )
    : cn('hover:bg-amber-50 hover:shadow-[inset_0_0_0_2px_#d97706]', LI_TD_CELL);

  const subCellCls = (field: EditableFieldKey) =>
    cn(
      'transition-shadow rounded-sm',
      isPrimaryEdit && selectedField === field
        ? 'shadow-[inset_0_0_0_2px_#2563eb] bg-white relative z-[1]'
        : '',
    );

  const selectField = (field: EditableFieldKey) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditState({ rowKey, field });
  };

  const category = [item.category, item.subCategory].filter(Boolean).join(' / ') || '—';
  const itemDropHighlight = useDropTargetHighlight(rowKey);

  const displayName = inputs?.name ?? item.name ?? '';
  const displayComponent = inputs?.component ?? item.component;
  const displayDescription = inputs?.description ?? item.description;
  const displayQty = inputs?.quantity ?? String(item.quantity ?? 0);
  const displayUnitType = inputs?.unitType || item.unitType?.externalReference || item.unitType?.name || '—';
  const displayUnitCost = inputs ? (parseFloat(inputs.unitCost) || 0) : (item.unitCost ?? 0);
  const displayMarkup = inputs
    ? (parseFloat(inputs.markupValue) || 0)
    : isFixedMarkupType(item.markupType)
      ? (item.markupValue ?? 0)
      : storedMarkupToUi(item.markupType, item.markupValue);
  const displayTax = inputs ? (parseFloat(inputs.tax) || 0) : storedTaxToUi(typeof item.tax === 'number' ? item.tax : 0);

  const detailHover = useLineDetailHover({
    title: displayName,
    component: displayComponent,
    description: displayDescription,
    note: item.note,
    hideComponent,
  });

  return (
    <>
      {detailHover.popup}
      <tr
        ref={setNodeRef}
        style={style}
        data-item-row
        data-row-key={rowKey}
        {...detailHover.handlers}
      className={cn(
        'cursor-pointer transition-colors',
        showSelect && !isPicked && 'opacity-40',
        itemDropHighlight
          ? itemDropHighlight
          : isEditing
          ? isMultiSelected
            ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
            : 'ring-2 ring-inset ring-amber-300 bg-amber-50/40'
          : isDirtyRow
            ? 'bg-emerald-100 hover:bg-emerald-200 hover:ring-2 hover:ring-inset hover:ring-emerald-400'
            : 'hover:bg-amber-50/40 hover:ring-2 hover:ring-inset hover:ring-amber-300',
      )}
      onClick={handleRowClick}
    >
      {showDragHandle && (
        <td className={ROW_LEAD_TD_DRAG}>
          <RowLeadDrag
            show
            attributes={attributes}
            listeners={listeners}
            iconClassName="text-slate-400 hover:text-slate-600"
          />
        </td>
      )}

      {(showBulkSelect || showSelect) && (
        <td className={showDragHandle ? ROW_LEAD_TD_CHECK : ROW_LEAD_TD_CHECK_LEAD}>
          <RowLeadCheckbox
            show
            checked={showBulkSelect ? isBulkSelected : isPicked}
            onCheckedChange={() => {
              if (showBulkSelect) item.id && handleBulkToggle([item.id]);
              else item.id && selection?.onChange(toggleId(selection.selectedIds, item.id));
            }}
            aria-label={`Select ${item.name ?? 'item'}`}
          />
        </td>
      )}

      {/* Name / Component / Description column */}
      <td
        data-col="name"
        className={cn(nameColTdCls, 'min-w-0')}
        onClick={cellClick('name')}
      >
        {showNormalInputs ? (
          <div className={cn(indented && 'pl-7')}>
            <div className="flex">
              <div
                className={cn('flex-1 min-w-0', subCellCls('name'))}
                onClick={selectField('name')}
              >
                <input
                  ref={(el) => { inputRefs.current.name = el; }}
                  value={inputs.name}
                  onChange={(e) => handleInputChange(rowKey, 'name', e.target.value)}
                  onKeyDown={handleCellKeyDown}
                  onFocus={() => setEditState({ rowKey, field: 'name' })}
                  placeholder="Name…"
                  className={cn(inputCls('left'), 'truncate')}
                />
              </div>
              {!hideComponent && (
              <div
                className={cn('flex-1 min-w-0 border-l border-slate-200', subCellCls('component'))}
                onClick={selectField('component')}
              >
                <input
                  ref={(el) => { inputRefs.current.component = el; }}
                  value={inputs.component}
                  onChange={(e) => handleInputChange(rowKey, 'component', e.target.value)}
                  onKeyDown={handleCellKeyDown}
                  onFocus={() => setEditState({ rowKey, field: 'component' })}
                  placeholder="Component…"
                  className={cn(inputCls('left'), 'truncate font-normal text-slate-600')}
                />
              </div>
              )}
            </div>
            <div
              className={cn('border-t border-slate-100', subCellCls('description'))}
              onClick={selectField('description')}
            >
              <input
                ref={(el) => { inputRefs.current.description = el; }}
                value={inputs.description}
                onChange={(e) => handleInputChange(rowKey, 'description', e.target.value)}
                onKeyDown={handleCellKeyDown}
                onFocus={() => setEditState({ rowKey, field: 'description' })}
                placeholder="Description…"
                className="w-full bg-transparent px-4 py-1.5 text-xs text-slate-500 outline-none placeholder:text-slate-300"
              />
            </div>
          </div>
        ) : (
          <div className={cn('min-w-0', indented && 'pl-7')}>
            <div className="truncate text-sm font-medium text-slate-900">
              {displayName || '—'}
              {!hideComponent && displayComponent && (
                <span className="font-normal text-slate-600"> — {displayComponent}</span>
              )}
              {item.internal && (
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                  internal
                </span>
              )}
              <LineScopeStatusBadge status={item.lineScopeStatus} />
              <PublishStatusBadge status={item.publishStatus} />
            </div>
            {displayDescription && <div className="truncate text-xs text-slate-400">{displayDescription}</div>}
            {item.catalogMissing && (
              <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700" title="This item references a catalogue entry that does not exist locally.">
                <AlertTriangle className="h-3 w-3" />
                Not in catalogue
              </span>
            )}
            {(item.mismatches?.length ?? 0) > 0 && (
              <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                Catalogue mismatch
              </span>
            )}
          </div>
        )}
      </td>

      {/* Type */}
      <td data-col="type" className={cn('whitespace-nowrap text-xs text-slate-500', LI_TD_CELL)}>
        {item.type || '—'}
      </td>

      {/* Category */}
      {showCategory && (
        <td data-col="category" className={cn('whitespace-nowrap text-xs text-slate-500', LI_TD_CELL)}>
          {category}
        </td>
      )}

      <LineScopeStatusField rowKey={rowKey} status={item.lineScopeStatus} />

      {/* Quantity */}
      {showQuantities && (
        <td data-col="quantity" className={cn(editRightCellCls('quantity'), qtyDisabled && 'opacity-30')} onClick={qtyDisabled ? undefined : cellClick('quantity')}>
          {qtyDisabled ? (
            <span className="block text-right font-mono text-sm text-slate-400">—</span>
          ) : showNormalInputs ? (
            <input
              ref={(el) => { inputRefs.current.quantity = el; }}
              className={inputCls()}
              value={inputs.quantity}
              onChange={(e) => handleInputChange(rowKey, 'quantity', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey, field: 'quantity' })}
            />
          ) : (
            <span className="block text-right font-mono text-sm text-slate-700">
              {displayQty}
            </span>
          )}
        </td>
      )}

      {/* Unit Type */}
      {showQuantities && (
        <td data-col="unitType" className={cn(editRightCellCls('unitType'), qtyDisabled && 'opacity-30')} onClick={qtyDisabled ? undefined : cellClick('unitType')}>
          {qtyDisabled ? (
            <span className="block text-right text-xs text-slate-400">—</span>
          ) : showNormalInputs ? (
            <select
              className={cn('w-full bg-transparent outline-none text-sm', LI_TD_CELL_RIGHT)}
              value={inputs.unitType}
              onChange={(e) => handleInputChange(rowKey, 'unitType', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey, field: 'unitType' })}
            >
              <option value="">—</option>
              {UNIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <span className="block text-right text-xs text-slate-500">
              {displayUnitType}
            </span>
          )}
        </td>
      )}

      {/* Unit Cost */}
      {showPriceBreakdown && (
        <td data-col="unitCost" className={cn(editMoneyCellCls('unitCost'), priceDisabled && 'opacity-30')} onClick={priceDisabled ? undefined : cellClick('unitCost')}>
          {priceDisabled ? (
            <span className="block text-right font-mono text-sm text-slate-400">—</span>
          ) : showNormalInputs ? (
            <input
              ref={(el) => { inputRefs.current.unitCost = el; }}
              className={LI_TD_MONEY_INPUT}
              value={inputs.unitCost}
              onChange={(e) => handleInputChange(rowKey, 'unitCost', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey, field: 'unitCost' })}
            />
          ) : (
            <span className="block text-right font-mono text-sm text-slate-700">
              {formatCurrency(displayUnitCost)}
            </span>
          )}
        </td>
      )}

      {/* Extended */}
      {showPriceBreakdown && (
        <td data-col="extended" className={cn(LI_TD_MONEY, 'text-slate-600', priceDisabled && 'opacity-30')}>
          {priceDisabled ? '—' : formatCurrency(money.extended)}
        </td>
      )}

      {/* Markup */}
      {showMarkupCol && (
        <td data-col="markupValue" className={cn(editMoneyCellCls('markupValue'), priceDisabled && 'opacity-30')} onClick={priceDisabled ? undefined : cellClick('markupValue')}>
          {priceDisabled ? (
            <span className="block text-right font-mono text-sm text-slate-400">—</span>
          ) : showNormalInputs ? (
            <input
              ref={(el) => { inputRefs.current.markupValue = el; }}
              className={LI_TD_MONEY_INPUT}
              value={inputs.markupValue}
              onChange={(e) => handleInputChange(rowKey, 'markupValue', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey, field: 'markupValue' })}
            />
          ) : (
            <span className="block text-right font-mono text-sm text-slate-700">
              {isFixedMarkupType(item.markupType)
                ? formatCurrency(displayMarkup)
                : `${displayMarkup}%`}
            </span>
          )}
        </td>
      )}

      {/* Tax */}
      {showGstCol && (
        <td data-col="tax" className={cn(editRightCellCls('tax'), priceDisabled && 'opacity-30')} onClick={priceDisabled ? undefined : cellClick('tax')}>
          {priceDisabled ? (
            <span className="block text-right font-mono text-sm text-slate-400">—</span>
          ) : showNormalInputs ? (
            <input
              ref={(el) => { inputRefs.current.tax = el; }}
              className={inputCls()}
              value={inputs.tax}
              onChange={(e) => handleInputChange(rowKey, 'tax', e.target.value)}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey, field: 'tax' })}
            />
          ) : (
            <span className="block text-right font-mono text-sm text-slate-700">
              {displayTax}%
            </span>
          )}
        </td>
      )}

      {/* Total */}
      {showPricing && (
        <td data-col="total" className={cn(LI_TD_MONEY, 'font-semibold text-slate-900', priceDisabled && 'opacity-30 text-slate-400')}>
          {priceDisabled ? '—' : formatCurrency(money.total)}
        </td>
      )}

      {/* Invoiced / Previously Invoiced (bill progress) */}
      {showInvoiceProgress && (
        <td
          data-col="invoiced"
          className={cn(
            invoiceOnlyEdit || (!isReadOnly && showInvoiceProgress)
              ? editMoneyCellCls('invoiced')
              : LI_TD_MONEY,
            'text-slate-700',
          )}
          onClick={
            invoiceOnlyEdit || !isReadOnly
              ? (e) => {
                  if (invoiceOnlyEdit) {
                    e.stopPropagation();
                    setEditInputs((prev) => {
                      if (prev[rowKey]) return prev;
                      return { ...prev, [rowKey]: initItemInputs(item) };
                    });
                    setEditState({ rowKey, field: 'invoiced' });
                    return;
                  }
                  cellClick('invoiced')(e);
                }
              : undefined
          }
        >
          {isEditing && inputs && (invoiceOnlyEdit || !isReadOnly) ? (
            <input
              ref={(el) => { inputRefs.current.invoiced = el; }}
              className={LI_TD_MONEY_INPUT}
              value={inputs.invoiced}
              onChange={(e) => {
                const raw = e.target.value;
                // Allow empty / intermediate typing (e.g. "-", "1.") until a full number exists.
                if (raw.trim() === '' || raw === '-' || raw.endsWith('.')) {
                  handleInputChange(rowKey, 'invoiced', raw);
                  return;
                }
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) {
                  handleInputChange(rowKey, 'invoiced', raw);
                  return;
                }
                const maxTotal = Math.max(
                  0,
                  money.total - (item.previouslyInvoiced ?? 0),
                );
                const clamped = Math.min(Math.max(0, parsed), maxTotal);
                // Preserve typed decimals when under the cap; rewrite when clamped.
                handleInputChange(
                  rowKey,
                  'invoiced',
                  clamped === parsed ? raw : String(clamped),
                );
              }}
              onBlur={() => {
                const parsed = Number(inputs.invoiced);
                const maxTotal = Math.max(
                  0,
                  money.total - (item.previouslyInvoiced ?? 0),
                );
                if (!Number.isFinite(parsed) || inputs.invoiced.trim() === '') {
                  handleInputChange(rowKey, 'invoiced', '0');
                  return;
                }
                const clamped = Math.min(Math.max(0, parsed), maxTotal);
                if (clamped !== parsed) {
                  handleInputChange(rowKey, 'invoiced', String(clamped));
                }
              }}
              onKeyDown={handleCellKeyDown}
              onFocus={() => setEditState({ rowKey, field: 'invoiced' })}
              inputMode="decimal"
              aria-label={`Invoiced amount (max ${formatCurrency(Math.max(0, money.total - (item.previouslyInvoiced ?? 0)))})`}
              title={`Maximum ${formatCurrency(Math.max(0, money.total - (item.previouslyInvoiced ?? 0)))}`}
            />
          ) : (
            <span className="block text-right font-mono text-sm text-slate-700">
              {formatCurrency(
                inputs?.invoiced != null && inputs.invoiced !== ''
                  ? Number(inputs.invoiced) || 0
                  : (item.invoiced ?? 0),
              )}
            </span>
          )}
        </td>
      )}
      {showInvoiceProgress && (
        <td data-col="previouslyInvoiced" className={cn(LI_TD_MONEY, 'text-slate-700')}>
          {formatCurrency(item.previouslyInvoiced ?? 0)}
        </td>
      )}

      {/* Notes icon */}
      {enableLineNotes && !showPricing && (
        <td className={LI_TD_NOTES}>
          {item.note && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700"
              onClick={(e) => {
                e.stopPropagation();
                actions.onEditLineNote?.({ targetType: 'item', targetId: item.id!, label: item.name ?? 'Item', note: item.note });
              }}
            >
              <StickyNote className="h-3.5 w-3.5 fill-amber-100" />
            </Button>
          )}
        </td>
      )}

      {/* Actions */}
      {!isReadOnly && actions.onDeleteItem && (
        <td className={LI_TD_ACTIONS} onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
            onClick={() => actions.onDeleteItem?.({ itemId: item.id!, itemName: item.name, isAssemblyChild: !!indented })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      )}
    </tr>
    </>
  );
});

function toggleId(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
