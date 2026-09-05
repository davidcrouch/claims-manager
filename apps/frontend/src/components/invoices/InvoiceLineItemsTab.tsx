'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Ref,
} from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/components/shared/detail';
import { updateInvoiceAction } from '@/app/(app)/mutations';
import { fetchInvoicesAction } from '@/app/(app)/invoices/actions';
import { getPurchaseOrderLineItemsAction } from '@/app/(app)/purchase-orders/actions';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';
import {
  applyInvoiceProgressToGroups,
  buildPreviouslyInvoicedMap,
  lineAmountFromItem,
  mergeInvoicedAmountsIntoInvoicePayload,
  sumUniqueInvoicedAmounts,
} from '@/components/invoices/invoice-line-progress';
import { PagedLineItemsTable } from '@/components/quotes/PagedLineItemsTable';
import {
  LineItemsProvider,
  LineItemsTable,
  buildLineItemOriginals,
  groupsFromDocumentPayload,
  parseRowKey,
  type ApiGroup,
  type ApiItem,
  type EditableFieldKey,
  type LineItemsActions,
} from '@/components/line-items';
import type { Invoice } from '@/types/api';

const PREFIX = 'frontend:InvoiceLineItemsTab';

export type InvoiceLineItemEdits = Record<string, Record<string, string>>;

export type InvoiceLineItemsTabHandle = {
  save: (edits?: InvoiceLineItemEdits) => void;
  resetEdits: () => void;
};

function readInvoicedAmountsMap(invoice: Invoice): Map<string, number> {
  const payload = (invoice.invoicePayload ?? invoice.apiPayload ?? {}) as Record<
    string,
    unknown
  >;
  const raw = payload.invoicedAmounts;
  const map = new Map<string, number>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n =
      typeof value === 'number' && Number.isFinite(value)
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : NaN;
    if (Number.isFinite(n)) map.set(key, n);
  }
  return map;
}

function findItemInGroups(groups: ApiGroup[], itemId: string): ApiItem | null {
  for (const group of groups) {
    for (const item of group.items ?? []) {
      if (item.id === itemId) return item;
    }
    for (const combo of group.combos ?? []) {
      for (const item of combo.items ?? []) {
        if (item.id === itemId) return item;
      }
    }
    for (const scope of group.scopes ?? []) {
      for (const item of scope.items ?? []) {
        if (item.id === itemId) return item;
      }
      for (const combo of scope.combos ?? []) {
        for (const item of combo.items ?? []) {
          if (item.id === itemId) return item;
        }
      }
    }
  }
  return null;
}

function InvoiceLineItemsTabInner(
  {
    invoice,
    onDirtyChange,
    onUndoCapture,
    onSaveStateChange,
    hideToolbarActions = false,
  }: {
    invoice: Invoice;
    onDirtyChange?: (dirty: boolean, save: () => void) => void;
    onUndoCapture?: (restoreEdits: InvoiceLineItemEdits) => void;
    onSaveStateChange?: (
      state: 'saving' | 'saved' | 'error',
      error?: string,
    ) => void;
    hideToolbarActions?: boolean;
  },
  ref: Ref<InvoiceLineItemsTabHandle>,
) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localInvoice, setLocalInvoice] = useState(invoice);
  const [siblingInvoices, setSiblingInvoices] = useState<Invoice[]>([]);
  const [resetEditsKey, setResetEditsKey] = useState(0);
  const groupsRef = useRef<ApiGroup[]>([]);
  const skipUndoRef = useRef(false);
  const onUndoCaptureRef = useRef(onUndoCapture);
  const onSaveStateChangeRef = useRef(onSaveStateChange);
  onUndoCaptureRef.current = onUndoCapture;
  onSaveStateChangeRef.current = onSaveStateChange;

  const canEdit = !localInvoice.sourceExternalReference;

  useEffect(() => {
    setLocalInvoice(invoice);
  }, [invoice]);

  useEffect(() => {
    const workOrderId = localInvoice.workOrderId;
    const purchaseOrderId = localInvoice.purchaseOrderId;
    if (!workOrderId && !purchaseOrderId) {
      setSiblingInvoices([]);
      return;
    }
    let cancelled = false;
    void fetchInvoicesAction({
      ...(workOrderId ? { workOrderId } : { purchaseOrderId: purchaseOrderId! }),
      limit: 100,
    }).then((res) => {
      if (cancelled) return;
      const rows = (res?.data ?? []).filter((row) => row.id !== localInvoice.id);
      setSiblingInvoices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [localInvoice.id, localInvoice.workOrderId, localInvoice.purchaseOrderId]);

  const payload = (localInvoice.invoicePayload ??
    localInvoice.apiPayload ??
    {}) as Record<string, unknown>;
  const payloadGroups = useMemo(
    () => groupsFromDocumentPayload(payload),
    [payload],
  );
  const lineItems = (payload.lineItems ?? payload.items ?? []) as Array<
    Record<string, unknown>
  >;

  const previouslyByKey = useMemo(
    () => buildPreviouslyInvoicedMap(siblingInvoices),
    [siblingInvoices],
  );
  const invoicedByKey = useMemo(
    () => readInvoicedAmountsMap(localInvoice),
    [localInvoice],
  );

  const transformGroups = useCallback(
    (groups: ApiGroup[]) => {
      const next = applyInvoiceProgressToGroups(
        groups,
        previouslyByKey,
        invoicedByKey,
      );
      groupsRef.current = next;
      return next;
    },
    [previouslyByKey, invoicedByKey],
  );

  const enrichedPayloadGroups = useMemo(
    () => transformGroups(payloadGroups),
    [payloadGroups, transformGroups],
  );

  const handleSave = useCallback(
    (edits: Record<string, Record<EditableFieldKey, string>>) => {
      startTransition(async () => {
        const amountsByItem: Array<{ item: ApiItem; amount: number }> = [];
        for (const [rowKey, fields] of Object.entries(edits)) {
          if (fields.invoiced == null) continue;
          const parsed = parseRowKey(rowKey);
          if (!parsed || parsed.type !== 'item') {
            console.warn(`${PREFIX}.handleSave — skip row`, rowKey);
            continue;
          }
          const item = findItemInGroups(groupsRef.current, parsed.id);
          if (!item) {
            console.warn(`${PREFIX}.handleSave — item not found`, parsed.id);
            continue;
          }
          const amount = Number(fields.invoiced);
          if (!Number.isFinite(amount)) continue;
          const lineTotal = lineAmountFromItem(item);
          const maxTotal = Math.max(0, lineTotal - (item.previouslyInvoiced ?? 0));
          const clamped = Math.min(Math.max(0, amount), maxTotal);
          amountsByItem.push({ item, amount: clamped });
        }

        if (amountsByItem.length === 0) {
          if (Object.keys(edits).length > 0) {
            onSaveStateChangeRef.current?.(
              'error',
              'Failed to save line items',
            );
            return;
          }
          onSaveStateChangeRef.current?.('saved');
          return;
        }

        const originals = buildLineItemOriginals(groupsRef.current, edits);
        const skipUndo = skipUndoRef.current;
        skipUndoRef.current = false;
        onSaveStateChangeRef.current?.('saving');

        const nextPayload = mergeInvoicedAmountsIntoInvoicePayload({
          invoicePayload: localInvoice.invoicePayload as
            | Record<string, unknown>
            | null
            | undefined,
          amountsByItem,
        });

        const amountsMap = new Map<string, number>();
        for (const [key, value] of Object.entries(
          (nextPayload.invoicedAmounts ?? {}) as Record<string, number>,
        )) {
          amountsMap.set(key, value);
        }
        const headerTotal = sumUniqueInvoicedAmounts(
          amountsMap,
          groupsRef.current,
        );

        const result = await updateInvoiceAction(localInvoice.id, {
          invoicePayload: nextPayload,
          totalAmount: headerTotal,
        });
        if (!result.success) {
          console.error(`${PREFIX}.handleSave`, result.error);
          onSaveStateChangeRef.current?.(
            'error',
            result.error ?? 'Failed to save line items',
          );
          return;
        }

        if (!skipUndo && Object.keys(originals).length > 0) {
          onUndoCaptureRef.current?.(originals);
        }

        if (result.invoice) {
          setLocalInvoice(result.invoice);
        } else {
          setLocalInvoice((prev) => ({
            ...prev,
            invoicePayload: nextPayload,
            totalAmount: String(headerTotal),
          }));
        }
        setResetEditsKey((k) => k + 1);
        onSaveStateChangeRef.current?.('saved');
        router.refresh();
      });
    },
    [localInvoice.id, localInvoice.invoicePayload, router],
  );

  const latestEditsRef = useRef<Record<string, Record<EditableFieldKey, string>>>(
    {},
  );
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  const handleTableDirtyChange = useCallback(
    (dirty: boolean, edits: Record<string, Record<EditableFieldKey, string>>) => {
      latestEditsRef.current = edits;
      onDirtyChange?.(dirty, () => saveRef.current(latestEditsRef.current));
    },
    [onDirtyChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      save: (edits) => {
        if (edits) skipUndoRef.current = true;
        handleSave(
          (edits ?? {}) as Record<string, Record<EditableFieldKey, string>>,
        );
      },
      resetEdits: () => {
        setResetEditsKey((k) => k + 1);
      },
    }),
    [handleSave],
  );

  const actions: LineItemsActions = useMemo(
    () => ({
      onSave: canEdit && !hideToolbarActions ? handleSave : undefined,
      onDirtyChange: canEdit ? handleTableDirtyChange : undefined,
    }),
    [canEdit, handleSave, handleTableDirtyChange, hideToolbarActions],
  );

  const tableProps = {
    quantitiesVisible: true as const,
    pricingVisible: true as const,
    pricingDetail: 'total-only' as const,
    showInvoiceProgress: true as const,
    showPreviouslyInvoiced: true as const,
    showItemTypeColumn: false as const,
    invoiceProgressEditable: canEdit,
    resetEditsKey,
    hideToolbarActions,
    actions,
  };

  if (localInvoice.purchaseOrderId) {
    return (
      <PagedLineItemsTable
        documentId={localInvoice.purchaseOrderId}
        loadAction={getPurchaseOrderLineItemsAction}
        fallbackGroups={enrichedPayloadGroups}
        emptyLabel="No line items found for this invoice."
        transformGroups={transformGroups}
        readOnly={!canEdit}
        {...tableProps}
      />
    );
  }

  if (localInvoice.workOrderId) {
    return (
      <PagedLineItemsTable
        documentId={localInvoice.workOrderId}
        loadAction={getWorkOrderLineItemsAction}
        fallbackGroups={enrichedPayloadGroups}
        emptyLabel="No line items found for this invoice."
        transformGroups={transformGroups}
        readOnly={!canEdit}
        {...tableProps}
      />
    );
  }

  if (enrichedPayloadGroups.length > 0) {
    return (
      <LineItemsProvider
        groups={enrichedPayloadGroups}
        mode={canEdit ? 'edit' : 'readonly'}
        {...tableProps}
      >
        <LineItemsTable hideToolbarActions={hideToolbarActions} />
      </LineItemsProvider>
    );
  }

  if (lineItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No line items found for this invoice.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Line Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Item Name</th>
                <th className="pb-2 pr-4 text-right font-medium">Qty</th>
                <th className="pb-2 pr-4 text-right font-medium">Unit</th>
                <th className="pb-2 pr-4 text-right font-medium">Total</th>
                <th className="pb-2 pr-4 text-right font-medium">This Invoice</th>
                <th className="pb-2 text-right font-medium">Prior Invoices</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => {
                const amount = lineAmountFromItem({
                  name: String(item.name ?? item.itemName ?? ''),
                  quantity:
                    typeof item.quantity === 'number'
                      ? item.quantity
                      : Number(item.quantity) || 0,
                  unitCost:
                    typeof item.unitCost === 'number'
                      ? item.unitCost
                      : Number(item.unitCost ?? item.unitPrice ?? item.rate) || 0,
                  total:
                    typeof item.total === 'number'
                      ? item.total
                      : Number(item.total ?? item.amount ?? item.lineTotal) ||
                        undefined,
                });
                const invoiced =
                  typeof item.invoiced === 'number'
                    ? item.invoiced
                    : Number(item.invoiced) || amount;
                const prior =
                  typeof item.previouslyInvoiced === 'number'
                    ? item.previouslyInvoiced
                    : Number(item.previouslyInvoiced) || 0;
                return (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {String(item.name ?? item.itemName ?? '—')}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {item.quantity != null ? String(item.quantity) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {String(item.unitType ?? item.unit ?? '—')}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatCurrency(amount)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {formatCurrency(invoiced)}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(prior)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export const InvoiceLineItemsTab = forwardRef(InvoiceLineItemsTabInner);
