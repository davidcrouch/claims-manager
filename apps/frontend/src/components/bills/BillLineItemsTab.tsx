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
import { PagedLineItemsTable } from '@/components/quotes/PagedLineItemsTable';
import { getPurchaseOrderLineItemsAction } from '@/app/(app)/purchase-orders/actions';
import { fetchPurchaseOrderBillsAction } from '@/app/(app)/bills/actions';
import { updateBillAction } from '@/app/(app)/mutations';
import {
  applyProgressToGroups,
  buildProgressMaps,
  lineAmountFromItem,
  mergeInvoicedAmountsIntoPayload,
} from '@/components/bills/bill-line-progress';
import type { Bill } from '@/types/api';

const PREFIX = 'frontend:BillLineItemsTab';

export type BillLineItemEdits = Record<string, Record<string, string>>;

export type BillLineItemsTabHandle = {
  save: (edits?: BillLineItemEdits) => void;
  resetEdits: () => void;
};

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

function BillLineItemsTabInner(
  {
    bill,
    onDirtyChange,
    onUndoCapture,
    onSaveStateChange,
    hideToolbarActions = false,
  }: {
    bill: Bill;
    onDirtyChange?: (dirty: boolean, save: () => void) => void;
    onUndoCapture?: (restoreEdits: BillLineItemEdits) => void;
    onSaveStateChange?: (state: 'saving' | 'saved' | 'error', error?: string) => void;
    hideToolbarActions?: boolean;
  },
  ref: Ref<BillLineItemsTabHandle>,
) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [localBill, setLocalBill] = useState(bill);
  const [siblingBills, setSiblingBills] = useState<Bill[]>([]);
  const [resetEditsKey, setResetEditsKey] = useState(0);
  const groupsRef = useRef<ApiGroup[]>([]);
  const skipUndoRef = useRef(false);
  const onUndoCaptureRef = useRef(onUndoCapture);
  const onSaveStateChangeRef = useRef(onSaveStateChange);
  onUndoCaptureRef.current = onUndoCapture;
  onSaveStateChangeRef.current = onSaveStateChange;

  useEffect(() => {
    setLocalBill(bill);
  }, [bill]);

  useEffect(() => {
    if (!localBill.purchaseOrderId) {
      setSiblingBills([]);
      return;
    }
    let cancelled = false;
    void fetchPurchaseOrderBillsAction(localBill.purchaseOrderId).then((rows) => {
      if (!cancelled) setSiblingBills(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [localBill.purchaseOrderId]);

  const payload = (localBill.billPayload ?? {}) as Record<string, unknown>;
  const payloadGroups = useMemo(() => groupsFromDocumentPayload(payload), [payload]);
  const lineItems = (payload.lineItems ?? payload.items ?? []) as Array<Record<string, unknown>>;

  const progressMaps = useMemo(
    () => buildProgressMaps({ currentBill: localBill, siblingBills }),
    [localBill, siblingBills],
  );

  const transformGroups = useCallback(
    (groups: ApiGroup[]) => {
      const next = applyProgressToGroups(groups, progressMaps);
      groupsRef.current = next;
      return next;
    },
    [progressMaps],
  );

  const enrichedPayloadGroups = useMemo(() => {
    const next = !localBill.purchaseOrderId
      ? applyProgressToGroups(payloadGroups, progressMaps, { noPoFallback: true })
      : applyProgressToGroups(payloadGroups, progressMaps);
    groupsRef.current = next;
    return next;
  }, [localBill.purchaseOrderId, payloadGroups, progressMaps]);

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
          const lineTotal =
            typeof item.total === 'number' && Number.isFinite(item.total)
              ? item.total
              : lineAmountFromItem(item) ?? 0;
          const maxTotal = Math.max(0, lineTotal);
          const clamped = Math.min(Math.max(0, amount), maxTotal);
          amountsByItem.push({ item, amount: clamped });
        }

        if (amountsByItem.length === 0) {
          if (Object.keys(edits).length > 0) {
            onSaveStateChangeRef.current?.('error', 'Failed to save line items');
            return;
          }
          onSaveStateChangeRef.current?.('saved');
          return;
        }

        const originals = buildLineItemOriginals(groupsRef.current, edits);
        const skipUndo = skipUndoRef.current;
        skipUndoRef.current = false;
        onSaveStateChangeRef.current?.('saving');

        const nextPayload = mergeInvoicedAmountsIntoPayload({
          billPayload: localBill.billPayload as Record<string, unknown> | null | undefined,
          amountsByItem,
        });

        const result = await updateBillAction(localBill.id, { billPayload: nextPayload });
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

        if (result.bill) {
          setLocalBill(result.bill);
        } else {
          setLocalBill((prev) => ({ ...prev, billPayload: nextPayload }));
        }
        setResetEditsKey((k) => k + 1);
        onSaveStateChangeRef.current?.('saved');
        router.refresh();
      });
    },
    [localBill.billPayload, localBill.id, router],
  );

  const latestEditsRef = useRef<Record<string, Record<EditableFieldKey, string>>>({});
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
        handleSave((edits ?? {}) as Record<string, Record<EditableFieldKey, string>>);
      },
      resetEdits: () => {
        setResetEditsKey((k) => k + 1);
      },
    }),
    [handleSave],
  );

  const actions: LineItemsActions = useMemo(
    () => ({
      onSave: hideToolbarActions ? undefined : handleSave,
      onDirtyChange: handleTableDirtyChange,
    }),
    [handleSave, handleTableDirtyChange, hideToolbarActions],
  );

  if (localBill.purchaseOrderId) {
    return (
      <PagedLineItemsTable
        documentId={localBill.purchaseOrderId}
        loadAction={getPurchaseOrderLineItemsAction}
        fallbackGroups={enrichedPayloadGroups}
        emptyLabel="No line items found for this bill."
        readOnly
        quantitiesVisible
        pricingVisible
        pricingDetail="total-only"
        showInvoiceProgress
        invoiceProgressEditable
        transformGroups={transformGroups}
        resetEditsKey={resetEditsKey}
        hideToolbarActions={hideToolbarActions}
        actions={actions}
      />
    );
  }

  if (enrichedPayloadGroups.length > 0) {
    return (
      <LineItemsProvider
        groups={enrichedPayloadGroups}
        mode="edit"
        quantitiesVisible
        pricingVisible
        pricingDetail="total-only"
        showInvoiceProgress
        invoiceProgressEditable
        resetEditsKey={resetEditsKey}
        hideToolbarActions={hideToolbarActions}
        actions={actions}
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
            No line items found for this bill.
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
                <th className="pb-2 pr-4 text-right font-medium">Total</th>
                <th className="pb-2 pr-4 text-right font-medium">Invoiced</th>
                <th className="pb-2 text-right font-medium">Previously Invoiced</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => {
                const amount =
                  lineAmountFromItem({
                    name: String(item.name ?? item.itemName ?? ''),
                    quantity: typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0,
                    unitCost:
                      typeof item.unitCost === 'number'
                        ? item.unitCost
                        : Number(item.unitCost ?? item.unitPrice ?? item.rate) || 0,
                    total:
                      typeof item.total === 'number'
                        ? item.total
                        : Number(item.total ?? item.amount ?? item.lineTotal) || undefined,
                    completed: item.completed === false ? false : undefined,
                  }) ?? 0;
                return (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2 pr-4">{String(item.name ?? item.itemName ?? '—')}</td>
                    <td className="py-2 pr-4 text-right">{item.quantity != null ? String(item.quantity) : '—'}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(amount)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(amount)}</td>
                    <td className="py-2 text-right">{formatCurrency(0)}</td>
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

export const BillLineItemsTab = forwardRef(BillLineItemsTabInner);
