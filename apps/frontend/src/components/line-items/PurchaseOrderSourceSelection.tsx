'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PurchaseOrder } from '@/types/api';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';
import { getProposalLineItemsAction } from '@/app/(app)/proposals/actions';
import {
  getPurchaseOrderLineItemsAction,
  replacePurchaseOrderLineItemsAction,
  savePurchaseOrderLineItemsAction,
} from '@/app/(app)/purchase-orders/actions';
import {
  LineItemsProvider,
  LineItemsTable,
  parseRowKey,
  syncLineItemSelectionAncestors,
  type ApiGroup,
  type ApiItem,
  type EditableFieldKey,
} from '@/components/line-items';

const PREFIX = 'frontend:PurchaseOrderSourceSelection';

export type PoLineItemEdits = Record<string, Record<string, string>>;

export interface PurchaseOrderSourceSelectionHandle {
  save: (edits?: PoLineItemEdits) => void;
  resetEdits: () => void;
}

const ITEM_SOURCE_KEYS = ['sourceWorkOrderItemId', 'sourceProposalItemId'] as const;
const COMBO_SOURCE_KEYS = ['sourceWorkOrderComboId', 'sourceProposalComboId'] as const;

export const PurchaseOrderSourceSelection = forwardRef(function PurchaseOrderSourceSelection(
  {
    purchaseOrder,
    sourceWorkOrderId,
    sourceProposalId,
    readOnly = false,
    hideToolbarActions = false,
    onDirtyChange,
    onSaveStateChange,
  }: {
    purchaseOrder: PurchaseOrder;
    sourceWorkOrderId?: string | null;
    sourceProposalId?: string | null;
    readOnly?: boolean;
    hideToolbarActions?: boolean;
    onDirtyChange?: (dirty: boolean, save: () => void) => void;
    onSaveStateChange?: (state: 'saving' | 'saved' | 'error', error?: string) => void;
  },
  ref: Ref<PurchaseOrderSourceSelectionHandle>,
) {
  const [poGroups, setPoGroups] = useState<ApiGroup[] | null>(null);
  const [sourceGroups, setSourceGroups] = useState<ApiGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [costDirty, setCostDirty] = useState(false);
  const [resetEditsKey, setResetEditsKey] = useState(0);
  const pageDirtyRef = useRef(false);
  const latestEditsRef = useRef<Record<string, Record<EditableFieldKey, string>>>({});
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onSaveStateChangeRef = useRef(onSaveStateChange);
  onDirtyChangeRef.current = onDirtyChange;
  onSaveStateChangeRef.current = onSaveStateChange;

  const loadPoGroups = useCallback(async () => {
    const result = await getPurchaseOrderLineItemsAction(purchaseOrder.id, { all: true });
    if (result.success && result.groups) {
      setPoGroups(result.groups as ApiGroup[]);
      return;
    }
    setError(result.error ?? 'Failed to load purchase order line items');
  }, [purchaseOrder.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadPoGroups()
      .catch((err) => {
        if (cancelled) return;
        console.error(`${PREFIX}.loadPoGroups`, err);
        setError(err instanceof Error ? err.message : 'Failed to load purchase order line items');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadPoGroups]);

  useEffect(() => {
    const sourceId = sourceWorkOrderId || sourceProposalId;
    if (!sourceId || sourceGroups) return;
    let cancelled = false;
    setSourceLoading(true);
    setSourceError(null);
    const load = sourceWorkOrderId
      ? getWorkOrderLineItemsAction(sourceWorkOrderId, { all: true })
      : getProposalLineItemsAction(sourceProposalId!, { all: true });
    void load
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.groups) {
          setSourceGroups(result.groups as ApiGroup[]);
          return;
        }
        setSourceError(result.error ?? 'Failed to load source line items');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(`${PREFIX}.loadSourceGroups`, err);
        setSourceError(err instanceof Error ? err.message : 'Failed to load source line items');
      })
      .finally(() => {
        if (!cancelled) setSourceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceWorkOrderId, sourceProposalId, sourceGroups]);

  const committedSourceIds = useMemo(() => {
    if (!poGroups) return new Set<string>();
    return collectPoSourceIds(poGroups);
  }, [poGroups]);

  const committedKey = useMemo(
    () => Array.from(committedSourceIds).sort().join('\0'),
    [committedSourceIds],
  );

  useEffect(() => {
    setSelectedIds(new Set(committedSourceIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by committedKey
  }, [committedKey]);

  const displayGroups = useMemo(
    () => overlayPoProcurementFields(sourceGroups ?? poGroups, poGroups),
    [sourceGroups, poGroups],
  );

  const selectionDirty = useMemo(() => {
    if (selectedIds.size !== committedSourceIds.size) return true;
    for (const id of selectedIds) {
      if (!committedSourceIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, committedSourceIds]);

  pageDirtyRef.current = (selectionDirty || costDirty) && !readOnly;

  const handleTableDirtyChange = useCallback(
    (dirty: boolean, edits: Record<string, Record<EditableFieldKey, string>>) => {
      latestEditsRef.current = edits;
      setCostDirty(dirty);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (readOnly || saving) return;
    const edits = latestEditsRef.current;
    const hasCostEdits = Object.keys(edits).length > 0;
    if (selectionDirty && selectedIds.size === 0) {
      onSaveStateChangeRef.current?.('error', 'Select at least one line item');
      return;
    }
    if (!selectionDirty && !hasCostEdits) return;
    setSaving(true);
    onSaveStateChangeRef.current?.('saving');
    try {
      let nextPoGroups = poGroups ?? [];
      if (selectionDirty) {
        const synced = syncLineItemSelectionAncestors(displayGroups, selectedIds);
        const result = await replacePurchaseOrderLineItemsAction(
          purchaseOrder.id,
          Array.from(synced),
        );
        if (!result.success) {
          onSaveStateChangeRef.current?.(
            'error',
            result.error ?? 'Failed to update purchase order line items',
          );
          return;
        }
        nextPoGroups = (result.groups as ApiGroup[] | undefined) ?? [];
        setPoGroups(nextPoGroups);
      }

      const costItems = collectPoFieldUpdates(edits, nextPoGroups, sourceGroups);
      if (costItems.length > 0) {
        const costResult = await savePurchaseOrderLineItemsAction({
          purchaseOrderId: purchaseOrder.id,
          items: costItems,
          combos: [],
        });
        if (!costResult.success) {
          console.error(`${PREFIX}.handleSave — procurement field save failed`, costResult.error);
          onSaveStateChangeRef.current?.(
            'error',
            costResult.error ?? 'Failed to save purchase order line items',
          );
          return;
        }
        nextPoGroups = applyPoFieldUpdates(nextPoGroups, costItems);
        setPoGroups(nextPoGroups);
      }

      latestEditsRef.current = {};
      setCostDirty(false);
      setResetEditsKey((k) => k + 1);
      onSaveStateChangeRef.current?.('saved');
    } catch (err) {
      console.error(`${PREFIX}.handleSave`, err);
      onSaveStateChangeRef.current?.(
        'error',
        err instanceof Error ? err.message : 'Failed to update purchase order line items',
      );
    } finally {
      setSaving(false);
    }
  }, [
    displayGroups,
    poGroups,
    sourceGroups,
    purchaseOrder.id,
    readOnly,
    saving,
    selectedIds,
    selectionDirty,
  ]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useImperativeHandle(ref, () => ({
    save: (_edits?: PoLineItemEdits) => {
      void handleSaveRef.current();
    },
    resetEdits: () => {
      setSelectedIds(new Set(committedSourceIds));
      latestEditsRef.current = {};
      setCostDirty(false);
      setResetEditsKey((k) => k + 1);
    },
  }), [committedSourceIds]);

  const pageDirty = (selectionDirty || costDirty) && !readOnly;

  useEffect(() => {
    onDirtyChangeRef.current?.(pageDirty, () => {
      void handleSaveRef.current();
    });
  }, [pageDirty]);

  const canSelect = !!sourceGroups && !readOnly && !loading && !error;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!displayGroups || displayGroups.length === 0) {
    if (sourceLoading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
          <p className="text-sm text-muted-foreground">
            No line items have been added to this purchase order.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sourceError && (
        <p className="text-sm text-destructive">{sourceError}</p>
      )}
      {sourceLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading source line items…
        </div>
      )}
      <LineItemsProvider
        groups={displayGroups}
        mode={canSelect ? 'selection' : 'readonly'}
        showColumnToggles
        initialShowUnselected={false}
        pricingDetail="cost"
        buyCostEditable={!readOnly}
        resetEditsKey={resetEditsKey}
        actions={{
          onDirtyChange: readOnly ? undefined : handleTableDirtyChange,
        }}
        selection={
          canSelect
            ? {
                selectedIds,
                onChange: setSelectedIds,
              }
            : undefined
        }
      >
        <LineItemsTable hideToolbarActions={hideToolbarActions} />
      </LineItemsProvider>
    </div>
  );
});

function stringField(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function collectPoSourceIds(groups: ApiGroup[]): Set<string> {
  const ids = new Set<string>();
  const collectCombo = (combo: NonNullable<ApiGroup['combos']>[number]) => {
    const comboSrc = stringField(combo as Record<string, unknown>, COMBO_SOURCE_KEYS);
    if (comboSrc) ids.add(comboSrc);
    else if (combo.id) ids.add(combo.id);
    for (const item of combo.items ?? []) {
      const src = stringField(item as Record<string, unknown>, ITEM_SOURCE_KEYS);
      if (src) ids.add(src);
      else if (item.id) ids.add(item.id);
    }
  };
  for (const group of groups) {
    for (const item of group.items ?? []) {
      const src = stringField(item as Record<string, unknown>, ITEM_SOURCE_KEYS);
      if (src) ids.add(src);
      else if (item.id) ids.add(item.id);
    }
    for (const combo of group.combos ?? []) collectCombo(combo);
    for (const scope of group.scopes ?? []) {
      const scopeSrc = stringField(scope as Record<string, unknown>, COMBO_SOURCE_KEYS);
      if (scopeSrc) ids.add(scopeSrc);
      else if (scope.id) ids.add(scope.id);
      for (const item of scope.items ?? []) {
        const src = stringField(item as Record<string, unknown>, ITEM_SOURCE_KEYS);
        if (src) ids.add(src);
        else if (item.id) ids.add(item.id);
      }
      for (const combo of scope.combos ?? []) collectCombo(combo);
    }
  }
  return ids;
}

function walkItems(groups: ApiGroup[], visit: (item: ApiItem) => void) {
  const visitCombo = (combo: NonNullable<ApiGroup['combos']>[number]) => {
    for (const item of combo.items ?? []) visit(item);
  };
  for (const group of groups) {
    for (const item of group.items ?? []) visit(item);
    for (const combo of group.combos ?? []) visitCombo(combo);
    for (const scope of group.scopes ?? []) {
      for (const item of scope.items ?? []) visit(item);
      for (const combo of scope.combos ?? []) visitCombo(combo);
    }
  }
}

function mapItems(groups: ApiGroup[], mapItem: (item: ApiItem) => ApiItem): ApiGroup[] {
  const mapCombo = (combo: NonNullable<ApiGroup['combos']>[number]) => ({
    ...combo,
    items: (combo.items ?? []).map(mapItem),
  });
  return groups.map((group) => ({
    ...group,
    items: (group.items ?? []).map(mapItem),
    combos: (group.combos ?? []).map(mapCombo),
    scopes: (group.scopes ?? []).map((scope) => ({
      ...scope,
      items: (scope.items ?? []).map(mapItem),
      combos: (scope.combos ?? []).map(mapCombo),
    })),
  }));
}

function sourceIdOf(item: ApiItem): string | undefined {
  return item.sourceWorkOrderItemId ?? item.sourceProposalItemId;
}

function overlayPoProcurementFields(
  displayGroups: ApiGroup[] | null,
  poGroups: ApiGroup[] | null,
): ApiGroup[] {
  if (!displayGroups) return [];
  if (!poGroups || poGroups === displayGroups) return displayGroups;

  const overlayBySourceId = new Map<string, Pick<ApiItem, 'buyCost' | 'quantity'>>();
  walkItems(poGroups, (item) => {
    const src = sourceIdOf(item);
    if (!src) return;
    overlayBySourceId.set(src, {
      buyCost: item.buyCost,
      quantity: item.quantity,
    });
  });

  return mapItems(displayGroups, (item) => {
    const overlay = item.id ? overlayBySourceId.get(item.id) : undefined;
    const sourceQty = item.quantity;
    const poQty = overlay?.quantity;
    const quantity =
      poQty != null && sourceQty != null
        ? Math.min(poQty, sourceQty)
        : (poQty ?? sourceQty);
    return {
      ...item,
      maxQuantity: sourceQty,
      ...(overlay?.buyCost != null ? { buyCost: overlay.buyCost } : {}),
      ...(quantity != null ? { quantity } : {}),
    };
  });
}

function findPoItem(groups: ApiGroup[], sourceOrPoItemId: string): ApiItem | null {
  let found: ApiItem | null = null;
  walkItems(groups, (item) => {
    if (found) return;
    if (item.id === sourceOrPoItemId) {
      found = item;
      return;
    }
    if (sourceIdOf(item) === sourceOrPoItemId) found = item;
  });
  return found;
}

type PoFieldUpdate = {
  id: string;
  buyCost?: string;
  quantity?: string;
};

function clampQuantity(value: string | undefined, maxQuantity: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  const min = 0;
  const max = maxQuantity != null && Number.isFinite(maxQuantity) ? maxQuantity : parsed;
  return String(Math.min(Math.max(min, parsed), max));
}

function collectPoFieldUpdates(
  edits: Record<string, Record<string, string>>,
  poGroups: ApiGroup[],
  sourceGroups: ApiGroup[] | null,
): PoFieldUpdate[] {
  const items: PoFieldUpdate[] = [];
  for (const [rowKey, fields] of Object.entries(edits)) {
    const parsed = parseRowKey(rowKey);
    if (!parsed || parsed.type !== 'item') continue;
    const poItem = findPoItem(poGroups, parsed.id);
    if (!poItem?.id) continue;
    const sourceItem = sourceGroups ? findPoItem(sourceGroups, parsed.id) : null;
    const maxQuantity = sourceItem?.quantity ?? sourceItem?.maxQuantity;
    items.push({
      id: poItem.id,
      buyCost: fields.buyCost,
      quantity: clampQuantity(fields.quantity, maxQuantity),
    });
  }
  return items;
}

function applyPoFieldUpdates(groups: ApiGroup[], updates: PoFieldUpdate[]): ApiGroup[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  return mapItems(groups, (item) => {
    if (!item.id) return item;
    const update = byId.get(item.id);
    if (!update) return item;
    const buy = update.buyCost != null ? parseFloat(update.buyCost) : undefined;
    const qty = update.quantity != null ? parseFloat(update.quantity) : undefined;
    return {
      ...item,
      ...(buy != null && !Number.isNaN(buy) ? { buyCost: buy } : {}),
      ...(qty != null && !Number.isNaN(qty) ? { quantity: qty } : {}),
    };
  });
}
