'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  ExternalLink,
  Calendar,
  FileSignature,
  Package,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
} from '@/components/shared/detail';
import type { Claim, Invoice, Job, PurchaseOrder, WorkOrder } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { PublishButton } from '@/components/shared/PublishButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import { entityArchiveLabel, entityDetailHeaderTitles } from '@/components/shared/EntityDetailTitle';
import { invoiceInsurerRef } from '@/components/invoices/invoice-label';
import {
  InvoicePublishWizard,
  type InvoicePublishMode,
} from '@/components/invoices/InvoicePublishWizard';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { useJobCaps } from '@/hooks/useJobCaps';
import {
  InvoiceLineItemsTab,
  type InvoiceLineItemEdits,
  type InvoiceLineItemsTabHandle,
} from '@/components/invoices/InvoiceLineItemsTab';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_UNDO,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  pushUndoEntry,
} from '@/components/shared/detail-autosave';
import { DetailUndoButton } from '@/components/shared/DetailAutosaveActions';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';

// ---------- header ----------------------------------------------------------

export function InvoicePageHeader({
  invoice,
  job,
}: {
  invoice: Invoice;
  job?: Job | null;
  claim?: Claim | null;
  workOrder?: WorkOrder | null;
  purchaseOrder?: PurchaseOrder | null;
}) {
  const statusName = invoice.status?.name ?? 'Unknown';
  const titles = entityDetailHeaderTitles({
    internalNumber: invoice.internalNumber,
    secondaryLabel: invoice.invoiceNumber,
    fallbackId: invoice.id,
  });

  return (
    <PageHeaderLayout
      leading={<BackButton href={job ? `/invoices?jobId=${job.id}` : '/invoices'} label="Back to invoices" />}
      icon={
        <PageHeaderIcon
          icon={Receipt}
          className="bg-teal-100"
          iconClassName="text-teal-600"
        />
      }
      topTitle={titles.topTitle}
      title={titles.title}
      titleMono={titles.titleMono}
      topRow={
        <>
          <StatusBadge status={statusName} />
          {(invoice as any).syncStatus && (
            <SyncStatusIndicator syncStatus={(invoice as any).syncStatus} compact />
          )}
          {invoice.purchaseOrderId && (
            <Link
              href={`/purchase-orders/${invoice.purchaseOrderId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View PO
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {!invoice.purchaseOrderId && invoice.workOrderId && (
            <Link
              href={`/work-orders/${invoice.workOrderId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View work order
              <ExternalLink className="h-3 w-3" />
            </Link>
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
        </>
      }
      bottomRow={
        <>
          <PageHeaderField label="Amount">{formatCurrency(invoice.totalAmount)}</PageHeaderField>
          <PageHeaderField label="Issue date">{formatDate(invoice.issueDate)}</PageHeaderField>
          <PageHeaderField label="Updated">{formatDateTime(invoice.updatedAt)}</PageHeaderField>
        </>
      }
    />
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ invoice }: { invoice: Invoice }) {
  const status = invoice.status?.name ?? 'Unknown';

  return (
    <SectionCard
      title="Invoice Details"
      icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow label="Invoice number" value={invoice.invoiceNumber ?? '—'} />
      <DefRow label="Insurer Ref" value={invoiceInsurerRef(invoice) ?? '—'} />
      <DefRow label="Status" value={<StatusBadge status={status} />} />
      <DefRow label="Total amount" value={formatCurrency(invoice.totalAmount)} />
      <DefRow label="Sub-total" value={formatCurrency(invoice.subTotal)} />
      <DefRow label="Tax" value={formatCurrency(invoice.tax)} />
      <DefRow label="Excess amount" value={formatCurrency(invoice.excessAmount)} />
      <DefRow label="Issue date" value={formatDate(invoice.issueDate)} />
    </SectionCard>
  );
}

function TimelineTab({ invoice }: { invoice: Invoice }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(invoice.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(invoice.updatedAt)} />
      </SectionCard>
    </div>
  );
}

// ---------- container -------------------------------------------------------

type InvTab = 'overview' | 'line-items' | 'timeline';

type LineItemsUndoEntry = { kind: 'line-items'; edits: InvoiceLineItemEdits };

export function InvoiceDetail({
  invoice,
  job,
  claim,
  workOrder,
  purchaseOrder,
}: {
  invoice: Invoice;
  job?: Job | null;
  claim?: Claim | null;
  workOrder?: WorkOrder | null;
  purchaseOrder?: PurchaseOrder | null;
}) {
  const caps = useJobCaps(job);
  const [tab, setTab] = useState<InvTab>('overview');
  const [lineItemsMounted, setLineItemsMounted] = useState(false);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [lineItemsSaving, setLineItemsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lineItemsEditTick, setLineItemsEditTick] = useState(0);
  const [undoStack, setUndoStack] = useState<LineItemsUndoEntry[]>([]);
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const lineItemsRef = useRef<InvoiceLineItemsTabHandle | null>(null);

  const statusName = invoice.status?.name ?? 'Unknown';
  const canPublish = !invoice.sourceExternalReference;
  const canEditLineItems = !invoice.sourceExternalReference;
  const publishMode: InvoicePublishMode =
    caps.publishMode === 'external' ? 'external' : 'internal';
  const canUndo = canEditLineItems && (lineItemsDirty || undoStack.length > 0);

  useEffect(() => {
    setLineItemsDirty(false);
    setSaveError(null);
    setJustSaved(false);
    setUndoStack([]);
    setLineItemsMounted(tab === 'line-items');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount take-off for the new invoice
  }, [invoice.id]);

  useEffect(() => {
    if (tab === 'line-items') setLineItemsMounted(true);
  }, [tab]);

  const pushUndo = useCallback((entry: LineItemsUndoEntry) => {
    setUndoStack((prev) => pushUndoEntry(prev, entry, MAX_UNDO));
  }, []);

  const handleLineItemsDirtyChange = useCallback(
    (dirty: boolean, save: () => void) => {
      setLineItemsDirty(dirty);
      saveLineItemsRef.current = save;
      setLineItemsEditTick((n) => n + 1);
    },
    [],
  );

  const handleLineItemsUndoCapture = useCallback(
    (restoreEdits: InvoiceLineItemEdits) => {
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
    if (!canEditLineItems || !lineItemsDirty || lineItemsSaving) return;
    const timer = setTimeout(() => {
      saveLineItemsRef.current?.();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [canEditLineItems, lineItemsDirty, lineItemsSaving, lineItemsEditTick]);

  useEffect(() => {
    if (!justSaved || lineItemsDirty || lineItemsSaving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved, lineItemsDirty, lineItemsSaving, saveError]);

  const handleUndo = useCallback(() => {
    if (!canEditLineItems || lineItemsSaving) return;

    if (lineItemsDirty) {
      lineItemsRef.current?.resetEdits();
      setSaveError(null);
      return;
    }

    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    lineItemsRef.current?.save(entry.edits);
  }, [canEditLineItems, lineItemsSaving, lineItemsDirty, undoStack]);

  const tabs: Array<{ id: InvTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
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
        <HeaderActionToolbar>
          {canEditLineItems && (
            <DetailUndoButton
              canUndo={canUndo}
              undoDisabled={lineItemsSaving}
              onUndo={handleUndo}
            />
          )}
          {canPublish && (
            <PublishButton onClick={() => setPublishWizardOpen(true)} />
          )}
          <PrintButton documentType="invoice" entityId={invoice.id} jobId={job?.id} />
          <ArchiveEntityButton
            entityType="invoice"
            entityId={invoice.id}
            statusName={statusName}
            entityLabel={entityArchiveLabel(
              invoice.internalNumber,
              null,
              invoice.invoiceNumber,
              invoice.id,
            )}
            redirectTo={job ? `/invoices?jobId=${job.id}` : '/invoices'}
          />
        </HeaderActionToolbar>
      </SetHeaderActions>
      <InvoicePublishWizard
        open={publishWizardOpen}
        onOpenChange={setPublishWizardOpen}
        invoice={invoice}
        job={job}
        claim={claim}
        workOrder={workOrder}
        purchaseOrder={purchaseOrder}
        mode={publishMode}
      />
      <div className="flex flex-wrap gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                active
                  ? 'border-teal-600 bg-teal-50 text-teal-600'
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
        {saveError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}
        {tab === 'overview' && <OverviewTab invoice={invoice} />}
        {lineItemsMounted && (
          <div className={tab === 'line-items' ? undefined : 'hidden'}>
            <InvoiceLineItemsTab
              ref={lineItemsRef}
              invoice={invoice}
              onDirtyChange={handleLineItemsDirtyChange}
              onUndoCapture={handleLineItemsUndoCapture}
              onSaveStateChange={handleLineItemsSaveState}
              hideToolbarActions
            />
          </div>
        )}
        {tab === 'timeline' && <TimelineTab invoice={invoice} />}
      </div>
    </div>
  );
}
