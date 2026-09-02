'use client';

/**
 * Purchase Order detail view.
 *
 * Field coverage and section layout track `docs/mapping/purchase_orders.md`
 * (§2 identity / §3 parents / §4 lookups / §5 service window / §6 parties /
 * §7 scalars / §8 adjustment+allocation / §9 line items / §10 payload fallback).
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  ExternalLink,
  Building2,
  Calendar,
  DollarSign,
  FileSignature,
  Hash,
  Layers,
  Lock,
  Package,
  Paperclip,
  Phone,
  Receipt,
  Send,
  User,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatCurrency,
  formatAddress,
  pick,
  asString,
  type Dict,
} from '@/components/shared/detail';
import type { PurchaseOrder, Job } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import { entityArchiveLabel, entityDetailName, entityDetailHeaderTitles } from '@/components/shared/EntityDetailTitle';
import { isArchivedStatus } from '@/components/shared/archive-list';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_UNDO,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  pushUndoEntry,
} from '@/components/shared/detail-autosave';
import { DetailUndoButton } from '@/components/shared/DetailAutosaveActions';
import {
  PurchaseOrderLineItemsTab,
  type PurchaseOrderLineItemsTabHandle,
  type PoLineItemEdits,
} from '@/components/line-items/PurchaseOrderLineItemsTab';
import { IssuesTab } from '@/components/purchase-orders/IssuesTab';
import { IssuePoDrawer } from '@/components/purchase-orders/IssuePoDrawer';

// ---------- helpers ---------------------------------------------------------

function getPayload(po: PurchaseOrder): Dict {
  return (po.purchaseOrderPayload as Dict | undefined) ?? {};
}

function getParty(po: PurchaseOrder, key: 'poTo' | 'poFor' | 'poFrom'): Dict {
  return (po[key] as Dict | undefined) ?? {};
}

function getServiceWindow(po: PurchaseOrder): Dict {
  return (po.serviceWindow as Dict | undefined) ?? {};
}

function getAllocationContext(po: PurchaseOrder): Dict {
  return (po.allocationContext as Dict | undefined) ?? {};
}

/**
 * Pull a displayable lookup name, preferring the joined lookup ref when
 * present and falling back to the `name` key inside the verbatim CW payload.
 */
function lookupName(
  po: PurchaseOrder,
  joined: PurchaseOrder['status'] | PurchaseOrder['vendor'] | PurchaseOrder['purchaseOrderType'],
  payloadKey: string,
): string | undefined {
  const fromJoin = joined?.name;
  if (fromJoin) return fromJoin;
  const payload = getPayload(po);
  const block = payload[payloadKey] as Dict | undefined;
  return asString(block?.name) ?? asString(payload[payloadKey]);
}

export function getPurchaseOrderStatusName(po: PurchaseOrder): string {
  return lookupName(po, po.status, 'status') ?? 'Unknown';
}

export function isPurchaseOrderLocked(po: PurchaseOrder): boolean {
  return isArchivedStatus(getPurchaseOrderStatusName(po));
}

function partyAddress(party: Dict): string {
  return formatAddress(party);
}

type LineItemsUndoEntry = { kind: 'line-items'; edits: PoLineItemEdits };

// ---------- header ----------------------------------------------------------

export function PurchaseOrderPageHeader({ po, job }: { po: PurchaseOrder; job?: Job | null }) {
  const displayName = entityDetailName(
    po.name,
    po.purchaseOrderNumber ?? po.externalId,
    po.id,
  );
  const status = getPurchaseOrderStatusName(po);
  const locked = isPurchaseOrderLocked(po);
  const poType = lookupName(po, po.purchaseOrderType, 'purchaseOrderType');
  const vendor = lookupName(po, po.vendor, 'vendor');
  const total = formatCurrency(po.totalAmount);
  const titles = entityDetailHeaderTitles({
    internalNumber: po.internalNumber,
    name: po.name,
    secondaryLabel: po.purchaseOrderNumber ?? po.externalId,
    fallbackId: po.id,
  });

  return (
    <PageHeaderLayout
      leading={<BackButton href={job ? `/purchase-orders?jobId=${job.id}` : '/purchase-orders'} label="Back to purchase orders" />}
      icon={
        <PageHeaderIcon
          icon={ShoppingCart}
          className="bg-orange-100"
          iconClassName="text-orange-600"
        />
      }
      topTitle={titles.topTitle}
      title={titles.title}
      titleMono={titles.titleMono}
      topRow={
        <>
          {po.externalId && po.externalId !== displayName && (
            <span className="font-mono text-xs text-muted-foreground">· {po.externalId}</span>
          )}
          <StatusBadge status={status} />
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
          {poType && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              {poType}
            </span>
          )}
          {vendor && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {vendor}
            </span>
          )}
          {job && (
            <Link
              href={`/jobs/${job.id}`}
              className="inline-flex items-center gap-1 text-xs uppercase text-primary hover:underline"
            >
              {jobDisplayName(job)}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {po.claimId && (
            <Link
              href={`/claims/${po.claimId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View claim
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </>
      }
      bottomRow={
        <>
          <PageHeaderField label="Total">{total}</PageHeaderField>
          <PageHeaderField label="Start">{formatDate(po.startDate)}</PageHeaderField>
          <PageHeaderField label="End">{formatDate(po.endDate)}</PageHeaderField>
        </>
      }
    />
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ po }: { po: PurchaseOrder }) {
  const status = lookupName(po, po.status, 'status') ?? 'Unknown';
  const poType = lookupName(po, po.purchaseOrderType, 'purchaseOrderType') ?? '—';
  const vendor = lookupName(po, po.vendor, 'vendor') ?? '—';
  const service = getServiceWindow(po);
  const expiresInDays = asString(
    pick(service, 'expiresInDays') ?? pick(getAllocationContext(po), 'expiresInDays'),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">{status}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="mt-1 text-sm font-medium">{poType}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(po.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Adjusted total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(po.adjustedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Purchase Order Identifiers"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="PO number" value={po.purchaseOrderNumber ?? '—'} />
          <DefRow label="External ID" value={po.externalId ?? '—'} />
          <DefRow label="Name" value={po.name ?? '—'} />
          <DefRow label="Status" value={status} />
          <DefRow label="Type" value={poType} />
          <DefRow label="Vendor" value={vendor} />
        </SectionCard>

        <SectionCard
          title="Linked Entities"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Job"
            value={
              po.jobId ? (
                <Link
                  href={`/jobs/${po.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {po.jobId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Claim"
            value={
              po.claimId ? (
                <Link
                  href={`/claims/${po.claimId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {po.claimId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Vendor"
            value={
              po.vendorId ? (
                <Link
                  href={`/vendors/${po.vendorId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {po.vendorId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow label="Estimate" value={po.quoteId ?? '—'} />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Service Window"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Start date" value={formatDate(po.startDate)} />
          <DefRow label="End date" value={formatDate(po.endDate)} />
          <DefRow label="Start time" value={po.startTime ?? '—'} />
          <DefRow label="End time" value={po.endTime ?? '—'} />
          <DefRow label="Expires in (days)" value={expiresInDays ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Financial"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Total" value={formatCurrency(po.totalAmount)} />
          <DefRow label="Adjusted total" value={formatCurrency(po.adjustedTotal)} />
          <DefRow
            label="Adjustment amount"
            value={formatCurrency(po.adjustedTotalAdjustmentAmount)}
          />
        </SectionCard>
      </div>

      {po.note ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{po.note}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PartyCard({
  title,
  party,
  icon,
}: {
  title: string;
  party: Dict;
  icon: React.ReactNode;
}) {
  const address = partyAddress(party);
  return (
    <SectionCard title={title} icon={icon}>
      <DefRow label="Name" value={asString(pick(party, 'name')) ?? '—'} />
      <DefRow
        label="Contact name"
        value={asString(pick(party, 'contactName')) ?? '—'}
      />
      <DefRow
        label="Company reg. #"
        value={asString(pick(party, 'companyRegistrationNumber')) ?? '—'}
      />
      <DefRow
        label="Invoice number"
        value={asString(pick(party, 'invoiceNumber')) ?? '—'}
      />
      <DefRow
        label="Phone"
        value={asString(pick(party, 'phoneNumber')) ?? '—'}
      />
      <DefRow label="Email" value={asString(pick(party, 'email')) ?? '—'} />
      <DefRow label="Address" value={address || '—'} />
    </SectionCard>
  );
}

function PartiesTab({ po }: { po: PurchaseOrder }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PartyCard
        title="PO To (vendor / recipient)"
        party={getParty(po, 'poTo')}
        icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="PO For (insured / customer)"
        party={getParty(po, 'poFor')}
        icon={<User className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="PO From (issuing / insurer)"
        party={getParty(po, 'poFrom')}
        icon={<Phone className="h-4 w-4 text-muted-foreground" />}
      />
      <SectionCard
        title="Promoted party columns"
        icon={<Hash className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="PO to email" value={po.poToEmail ?? '—'} />
        <DefRow label="PO for name" value={po.poForName ?? '—'} />
      </SectionCard>
    </div>
  );
}

function LineItemsTab({
  po,
  locked,
  drawerOpen,
  onDrawerOpenChange,
  lineItemsRef,
  onDirtyChange,
  onUndoCapture,
  onSaveStateChange,
}: {
  po: PurchaseOrder;
  locked: boolean;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  lineItemsRef: RefObject<PurchaseOrderLineItemsTabHandle | null>;
  onDirtyChange: (dirty: boolean, save: () => void) => void;
  onUndoCapture: (restoreEdits: PoLineItemEdits) => void;
  onSaveStateChange: (state: 'saving' | 'saved' | 'error', error?: string) => void;
}) {
  return (
    <PurchaseOrderLineItemsTab
      ref={lineItemsRef}
      purchaseOrder={po}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={onDrawerOpenChange}
      readOnly={locked}
      onDirtyChange={onDirtyChange}
      onUndoCapture={onUndoCapture}
      onSaveStateChange={onSaveStateChange}
      hideToolbarActions
    />
  );
}

function BillsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Bills</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Bills received from the downstream vendor against this PO will appear
          here once the bills API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function AttachmentsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Attachments</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Attachments linked to this purchase order will appear here once the
          attachments API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- container -------------------------------------------------------

type PoTab =
  | 'overview'
  | 'parties'
  | 'line-items'
  | 'issues'
  | 'bills'
  | 'attachments';

export function PurchaseOrderDetail({
  po,
  job,
}: {
  po: PurchaseOrder;
  job?: Job | null;
}) {
  const [tab, setTab] = useState<PoTab>('overview');
  const [lineItemsMounted, setLineItemsMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [issueDrawerOpen, setIssueDrawerOpen] = useState(false);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [lineItemsSaving, setLineItemsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lineItemsEditTick, setLineItemsEditTick] = useState(0);
  const [undoStack, setUndoStack] = useState<LineItemsUndoEntry[]>([]);
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const lineItemsRef = useRef<PurchaseOrderLineItemsTabHandle>(null);

  const locked = isPurchaseOrderLocked(po);
  const status = getPurchaseOrderStatusName(po);
  const showLineItemActions = tab === 'line-items' && !locked;
  const showIssueAction = !locked;
  const canUndo = lineItemsDirty || undoStack.length > 0;
  const poNumber = po.purchaseOrderNumber ?? po.internalNumber ?? po.externalId;
  const title = entityArchiveLabel(
    po.internalNumber,
    po.name,
    po.purchaseOrderNumber ?? po.externalId,
    po.id,
  );

  useEffect(() => {
    setLineItemsDirty(false);
    setSaveError(null);
    setJustSaved(false);
    setUndoStack([]);
    setLineItemsMounted(tab === 'line-items');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount take-off for the new PO
  }, [po.id]);

  useEffect(() => {
    if (tab === 'line-items') setLineItemsMounted(true);
  }, [tab]);

  const pushUndo = useCallback((entry: LineItemsUndoEntry) => {
    setUndoStack((prev) => pushUndoEntry(prev, entry, MAX_UNDO));
  }, []);

  const handleLineItemsDirtyChange = useCallback((dirty: boolean, save: () => void) => {
    setLineItemsDirty(dirty);
    saveLineItemsRef.current = save;
    setLineItemsEditTick((n) => n + 1);
  }, []);

  const handleLineItemsUndoCapture = useCallback(
    (restoreEdits: PoLineItemEdits) => {
      pushUndo({ kind: 'line-items', edits: cloneJson(restoreEdits) });
    },
    [pushUndo],
  );

  const handleLineItemsSaveState = useCallback(
    (state: 'saving' | 'saved' | 'error', error?: string) => {
      if (state === 'saving') {
        setLineItemsSaving(true);
        setJustSaved(false);
        setSaveError(null);
        return;
      }
      setLineItemsSaving(false);
      if (state === 'error') {
        setSaveError(error ?? 'Failed to save line items');
        return;
      }
      setJustSaved(true);
    },
    [],
  );

  useEffect(() => {
    if (locked || !lineItemsDirty || lineItemsSaving) return;
    const timer = setTimeout(() => {
      saveLineItemsRef.current?.();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [locked, lineItemsDirty, lineItemsSaving, lineItemsEditTick]);

  useEffect(() => {
    if (!justSaved || lineItemsDirty || lineItemsSaving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved, lineItemsDirty, lineItemsSaving, saveError]);

  const handleUndo = useCallback(() => {
    if (lineItemsSaving) return;

    if (lineItemsDirty) {
      lineItemsRef.current?.resetEdits();
      setSaveError(null);
      return;
    }

    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    lineItemsRef.current?.save(entry.edits);
  }, [lineItemsSaving, lineItemsDirty, undoStack]);

  const tabs: Array<{ id: PoTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'issues', label: 'Issues', icon: Send },
    { id: 'bills', label: 'Bills', icon: Receipt },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
  ];

  return (
    <div className="flex flex-col">
      <HeaderSaveStatus
        saving={lineItemsSaving}
        saveError={saveError}
        justSaved={justSaved}
        dirty={lineItemsDirty}
      />
      <SetHeaderActions>
        {showIssueAction && (
          <Button
            size="default"
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            onClick={() => {
              setTab('issues');
              setIssueDrawerOpen(true);
            }}
          >
            <Send className="h-3.5 w-3.5" />
            Issue
          </Button>
        )}
        {showLineItemActions && (
          <Button
            size="default"
            variant="outline"
            className="h-9 gap-1.5 px-4"
            onClick={() => setDrawerOpen(true)}
          >
            <Package className="h-3.5 w-3.5" />
            Catalogue
          </Button>
        )}
        <HeaderActionToolbar>
          <DetailUndoButton
            canUndo={canUndo}
            undoDisabled={lineItemsSaving}
            onUndo={handleUndo}
          />
          <PrintButton documentType="purchase_order" entityId={po.id} jobId={job?.id} />
          <ArchiveEntityButton
            entityType="purchase_order"
            entityId={po.id}
            statusName={status}
            entityLabel={title}
            redirectTo={job ? `/purchase-orders?jobId=${job.id}` : '/purchase-orders'}
          />
        </HeaderActionToolbar>
      </SetHeaderActions>
      <div className="flex gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (t.id !== 'line-items') {
                  setDrawerOpen(false);
                }
                setTab(t.id);
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                active
                  ? 'border-orange-600 bg-orange-50 text-orange-600'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tab === 'overview' && <OverviewTab po={po} />}
        {tab === 'parties' && <PartiesTab po={po} />}
        {lineItemsMounted && (
          <div className={tab === 'line-items' ? undefined : 'hidden'}>
            <LineItemsTab
              po={po}
              locked={locked}
              drawerOpen={drawerOpen}
              onDrawerOpenChange={setDrawerOpen}
              lineItemsRef={lineItemsRef}
              onDirtyChange={handleLineItemsDirtyChange}
              onUndoCapture={handleLineItemsUndoCapture}
              onSaveStateChange={handleLineItemsSaveState}
            />
          </div>
        )}
        {tab === 'bills' && <BillsTab />}
        {tab === 'issues' && (
          <IssuesTab
            purchaseOrderId={po.id}
            poNumber={poNumber}
            jobId={po.jobId ?? job?.id}
            issueDrawerOpen={issueDrawerOpen}
            onIssueDrawerOpenChange={setIssueDrawerOpen}
          />
        )}
        {tab === 'attachments' && <AttachmentsTab />}
      </div>
      {tab !== 'issues' && (
        <IssuePoDrawer
          open={issueDrawerOpen}
          onOpenChange={setIssueDrawerOpen}
          purchaseOrderId={po.id}
          poNumber={poNumber}
          jobId={po.jobId ?? job?.id}
        />
      )}
    </div>
  );
}
