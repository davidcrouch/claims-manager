'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  ExternalLink,
  Calendar,
  FileSignature,
  Package,
  CheckCircle2,
  Pencil,
  Banknote,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EntityAttachmentsTab } from '@/components/shared/EntityAttachmentsTab';
import { invoiceInsurerRef, invoiceStatusName, invoiceHasPositiveAmount, invoiceIsPaid, invoiceIsInvoiced, invoiceIsPartiallyPaid, invoiceAmountReceived, invoiceRemainingAmount } from '@/components/invoices/invoice-label';
import {
  InvoicePublishWizard,
  type InvoicePublishMode,
} from '@/components/invoices/InvoicePublishWizard';
import {
  InvoiceRecipientDrawer,
  formatInvoiceRecipientLabel,
} from '@/components/invoices/InvoiceRecipientDrawer';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { useJobCaps } from '@/hooks/useJobCaps';
import {
  InvoiceLineItemsTab,
  type InvoiceLineItemEdits,
  type InvoiceLineItemsTabHandle,
} from '@/components/invoices/InvoiceLineItemsTab';
import { InvoicePaymentsTab } from '@/components/invoices/InvoicePaymentsTab';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_UNDO,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  pushUndoEntry,
} from '@/components/shared/detail-autosave';
import { DetailUndoButton } from '@/components/shared/DetailAutosaveActions';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import { approveInvoiceAction, returnInvoiceToDraftAction, receiveInvoicePaymentAction } from '@/app/(app)/mutations';
import { useRequirePermission } from '@/components/providers/PermissionsProvider';

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
  const statusName = invoiceStatusName(invoice);
  const titles = entityDetailHeaderTitles({
    internalNumber: invoice.internalNumber,
    secondaryLabel: invoiceInsurerRef(invoice) ?? invoice.invoiceNumber,
    fallbackId: invoice.id,
  });

  return (
    <PageHeaderLayout
      job={job}
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
          {invoiceAmountReceived(invoice) > 0 && (
            <PageHeaderField label="Received">{formatCurrency(invoice.amountReceived)}</PageHeaderField>
          )}
          <PageHeaderField label="Issue date">{formatDate(invoice.issueDate)}</PageHeaderField>
          <PageHeaderField label="Updated">{formatDateTime(invoice.updatedAt)}</PageHeaderField>
        </>
      }
    />
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({
  invoice,
  canEditRecipient,
  onEditRecipient,
}: {
  invoice: Invoice;
  canEditRecipient: boolean;
  onEditRecipient: () => void;
}) {
  const status = invoiceStatusName(invoice);
  const recipientLabel = formatInvoiceRecipientLabel(invoice);

  return (
    <SectionCard
      title="Invoice Details"
      icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow label="Invoice number" value={invoice.invoiceNumber ?? '—'} />
      <DefRow label="Insurer Ref" value={invoiceInsurerRef(invoice) ?? '—'} />
      <DefRow label="Status" value={<StatusBadge status={status} />} />
      <DefRow
        label="Recipient"
        value={
          canEditRecipient ? (
            <button
              type="button"
              onClick={onEditRecipient}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-foreground hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Change recipient"
            >
              <span className="wrap-break-word underline decoration-slate-300 underline-offset-2 group-hover:decoration-blue-400">
                {recipientLabel}
              </span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-600" />
            </button>
          ) : (
            recipientLabel
          )
        }
      />
      <DefRow label="Total amount" value={formatCurrency(invoice.totalAmount)} />
      <DefRow label="Amount received" value={formatCurrency(invoice.amountReceived ?? 0)} />
      <DefRow label="Remaining" value={formatCurrency(invoiceRemainingAmount(invoice))} />
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

type InvTab = 'overview' | 'line-items' | 'payments' | 'attachments' | 'timeline';

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
  const [recipientDrawerOpen, setRecipientDrawerOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [returningToDraft, setReturningToDraft] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const lineItemsRef = useRef<InvoiceLineItemsTabHandle | null>(null);
  const router = useRouter();
  const requireApprove = useRequirePermission(
    'invoices.approve',
    'approve this invoice',
  );
  const requireUpdateInvoice = useRequirePermission(
    'invoices.update',
    'update this invoice',
  );
  const requirePublish = useRequirePermission(
    'invoices.publish',
    'publish this invoice',
  );

  const statusName = invoiceStatusName(invoice);
  const isLocalInvoice = !invoice.sourceExternalReference;
  const isDraft = statusName === 'Draft';
  const isReviewed = statusName === 'Reviewed';
  const isPaid = invoiceIsPaid(invoice);
  const hasPositiveAmount = invoiceHasPositiveAmount(invoice);
  const showApprove = isLocalInvoice && isDraft;
  const approveEnabled = showApprove && hasPositiveAmount && !approving;
  const showEditInvoice = isLocalInvoice && isReviewed;
  const canPublish = isLocalInvoice && isReviewed;
  const canEditRecipient =
    isLocalInvoice && (isDraft || isReviewed);
  const remainingAmount = invoiceRemainingAmount(invoice);
  const receivedAmount = invoiceAmountReceived(invoice);
  const showReceivedPayment =
    !isPaid &&
    (invoiceIsInvoiced(invoice) ||
      invoiceIsPartiallyPaid(invoice) ||
      Boolean(invoice.sourceExternalReference));
  const canEditLineItems = isLocalInvoice;
  const recipientType = invoice.recipientType ?? null;
  const publishMode: InvoicePublishMode =
    recipientType === 'insured' || recipientType === 'other'
      ? 'email'
      : recipientType === 'insurer' || caps.publishMode === 'external'
        ? 'external'
        : 'internal';
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

  async function handleApproveInvoice() {
    if (!requireApprove()) return;
    if (!approveEnabled) return;
    setApproving(true);
    try {
      const result = await approveInvoiceAction(invoice.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to approve invoice');
        return;
      }
      toast.success('Invoice approved');
      router.refresh();
    } catch (err) {
      console.error('[frontend:InvoiceDetail.handleApproveInvoice]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to approve invoice');
    } finally {
      setApproving(false);
    }
  }

  async function handleConfirmEditInvoice() {
    if (!requireUpdateInvoice()) return;
    if (!showEditInvoice || returningToDraft) return;
    setReturningToDraft(true);
    try {
      const result = await returnInvoiceToDraftAction(invoice.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to return invoice to draft');
        return;
      }
      toast.success('Invoice returned to draft');
      setEditConfirmOpen(false);
      router.refresh();
    } catch (err) {
      console.error('[frontend:InvoiceDetail.handleConfirmEditInvoice]', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to return invoice to draft',
      );
    } finally {
      setReturningToDraft(false);
    }
  }

  function openPaymentDialog() {
    if (!requireUpdateInvoice()) return;
    if (!showReceivedPayment || recordingPayment) return;
    setPaymentAmountInput(remainingAmount > 0 ? remainingAmount.toFixed(2) : '');
    setPaymentDialogOpen(true);
  }

  async function handleReceivedPayment() {
    if (!showReceivedPayment || recordingPayment) return;
    const amount = Math.round(Number(paymentAmountInput) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a payment amount greater than 0');
      return;
    }
    setRecordingPayment(true);
    try {
      const result = await receiveInvoicePaymentAction(invoice.id, amount);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to record payment');
        return;
      }
      const nextStatus = result.invoice
        ? invoiceStatusName(result.invoice)
        : amount >= remainingAmount
          ? 'Paid'
          : 'Partially Paid';
      toast.success(
        nextStatus === 'Paid' ? 'Payment recorded — invoice is paid' : 'Payment recorded — invoice is partially paid',
      );
      setPaymentDialogOpen(false);
      setTab('payments');
      router.refresh();
    } catch (err) {
      console.error('[frontend:InvoiceDetail.handleReceivedPayment]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  }

  const tabs: Array<{ id: InvTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'payments', label: 'Payments', icon: Banknote },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
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
        {showApprove && (
          <span
            title={
              hasPositiveAmount
                ? 'Approve Invoice'
                : 'Add an amount greater than 0 to approve this invoice'
            }
            className="inline-flex"
          >
            <Button
              size="default"
              disabled={!approveEnabled}
              className="h-9 gap-1.5 px-4 bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleApproveInvoice}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approving ? 'Approving…' : 'Approve Invoice'}
            </Button>
          </span>
        )}
        {showEditInvoice && (
          <Button
            size="default"
            disabled={returningToDraft}
            className="h-9 gap-1.5 px-4 bg-slate-700 text-white hover:bg-slate-600"
            onClick={() => {
              if (!requireUpdateInvoice()) return;
              setEditConfirmOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Invoice
          </Button>
        )}
        {showReceivedPayment && (
          <Button
            size="default"
            disabled={recordingPayment}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            onClick={openPaymentDialog}
          >
            <Banknote className="h-3.5 w-3.5" />
            Receive Payment
          </Button>
        )}
        <HeaderActionToolbar>
          {canEditLineItems && (
            <DetailUndoButton
              canUndo={canUndo}
              undoDisabled={lineItemsSaving}
              onUndo={handleUndo}
            />
          )}
          {canPublish && (
            <PublishButton
              title={
                publishMode === 'email'
                  ? 'Email invoice'
                  : publishMode === 'external'
                    ? 'Submit to Insurer'
                    : 'Publish'
              }
              onClick={() => {
                if (!requirePublish()) return;
                setPublishWizardOpen(true);
              }}
            />
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
      <Dialog
        open={editConfirmOpen}
        onOpenChange={(next) => {
          if (!returningToDraft) setEditConfirmOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Pencil className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Edit invoice</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Editing this invoice will set its status back to{' '}
                  <span className="font-medium text-foreground">Draft</span>. You will need
                  to approve it again before it can be published.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={returningToDraft}
              onClick={() => setEditConfirmOpen(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={returningToDraft}
              onClick={handleConfirmEditInvoice}
              className="h-9 px-4"
            >
              {returningToDraft ? 'Updating…' : 'Edit invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(next) => {
          if (!recordingPayment) setPaymentDialogOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Banknote className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Receive payment</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Enter the amount received. A payment greater than 0 marks the invoice{' '}
                  <span className="font-medium text-foreground">Partially Paid</span>. When the
                  total received covers the invoice amount, status becomes{' '}
                  <span className="font-medium text-foreground">Paid</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 px-1">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice total</p>
                <p className="font-medium">{formatCurrency(invoice.totalAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Already received</p>
                <p className="font-medium">{formatCurrency(receivedAmount)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-medium">{formatCurrency(remainingAmount)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-amount">Payment amount</Label>
              <Input
                id="invoice-payment-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={paymentAmountInput}
                disabled={recordingPayment}
                onChange={(e) => setPaymentAmountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleReceivedPayment();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={recordingPayment}
              onClick={() => setPaymentDialogOpen(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={recordingPayment}
              onClick={handleReceivedPayment}
              className="h-9 px-4 bg-blue-600 text-white hover:bg-blue-500"
            >
              {recordingPayment ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <InvoiceRecipientDrawer
        open={recipientDrawerOpen}
        onOpenChange={setRecipientDrawerOpen}
        invoice={invoice}
        job={job}
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
        {tab === 'overview' && (
          <OverviewTab
            invoice={invoice}
            canEditRecipient={canEditRecipient}
            onEditRecipient={() => {
              if (!requireUpdateInvoice()) return;
              setRecipientDrawerOpen(true);
            }}
          />
        )}
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
        {tab === 'payments' && <InvoicePaymentsTab invoice={invoice} />}
        {tab === 'attachments' && (
          <EntityAttachmentsTab
            entityId={invoice.id}
            relatedRecordType="Invoice"
            jobId={job?.id ?? invoice.jobId}
            entityLabel="this invoice"
          />
        )}
        {tab === 'timeline' && <TimelineTab invoice={invoice} />}
      </div>
    </div>
  );
}
