'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReceiptText,
  ExternalLink,
  Building2,
  Calendar,
  DollarSign,
  FileSignature,
  Package,
  ClipboardList,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { updateBillStatusAction } from '@/app/(app)/mutations-status';
import { approveBillAction, rejectBillAction, returnBillToReceivedAction } from '@/app/(app)/mutations';
import type { Bill, Job } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import {
  BillLineItemsTab,
  type BillLineItemEdits,
  type BillLineItemsTabHandle,
} from '@/components/bills/BillLineItemsTab';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_UNDO,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  pushUndoEntry,
} from '@/components/shared/detail-autosave';
import { DetailUndoButton } from '@/components/shared/DetailAutosaveActions';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import { billDisplayTitle, billVendorName, billStatusName, billHasPositiveAmount, billIsRejected } from '@/components/bills/bill-label';
import { useRequirePermission } from '@/components/providers/PermissionsProvider';

// ---------- header ----------------------------------------------------------

export function BillPageHeader({ bill, job }: { bill: Bill; job?: Job | null }) {
  const title = billDisplayTitle(bill);
  const status = billStatusName(bill);
  const vendor = billVendorName(bill);

  return (
    <PageHeaderLayout
      job={job}
      leading={<BackButton href={job ? `/bills?jobId=${job.id}` : '/bills'} label="Back to bills" />}
      icon={
        <PageHeaderIcon
          icon={ReceiptText}
          className="bg-rose-100"
          iconClassName="text-rose-600"
        />
      }
      title={title}
      topRow={
        <>
          <StatusBadge status={status} />
          {vendor && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {vendor}
            </span>
          )}
          {bill.purchaseOrderId && (
            <Link
              href={`/purchase-orders/${bill.purchaseOrderId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View PO
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
          <PageHeaderField label="Amount">{formatCurrency(bill.totalAmount)}</PageHeaderField>
          <PageHeaderField label="Received">{formatDate(bill.receivedDate)}</PageHeaderField>
          <PageHeaderField label="Due">{formatDate(bill.dueDate)}</PageHeaderField>
        </>
      }
    />
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ bill }: { bill: Bill }) {
  const status = billStatusName(bill);
  const paymentStatus = bill.paymentStatus?.name;
  const vendor = billVendorName(bill);

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
            <p className="text-xs text-muted-foreground">Payment status</p>
            <p className="mt-1 text-sm font-medium">{paymentStatus ?? '—'}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(bill.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(bill.totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Bill Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Bill number" value={bill.billNumber ?? '—'} />
          <DefRow label="External reference" value={bill.externalReference ?? '—'} />
          <DefRow label="Status" value={<StatusBadge status={status} />} />
          {paymentStatus && (
            <DefRow label="Payment status" value={<StatusBadge status={paymentStatus} />} />
          )}
          <DefRow
            label="Vendor (from)"
            value={
              bill.vendorId ? (
                <Link
                  href={`/vendors/${bill.vendorId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {vendor ?? bill.vendorId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                vendor ?? '—'
              )
            }
          />
          <DefRow
            label="PO"
            value={
              bill.purchaseOrderId ? (
                <Link
                  href={`/purchase-orders/${bill.purchaseOrderId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {bill.purchaseOrderId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Job"
            value={
              bill.jobId ? (
                <Link
                  href={`/jobs/${bill.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {bill.jobId}
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
              bill.claimId ? (
                <Link
                  href={`/claims/${bill.claimId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {bill.claimId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
        </SectionCard>

        <SectionCard
          title="Financial & Dates"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Amount" value={formatCurrency(bill.totalAmount)} />
          <DefRow label="Sub-total" value={formatCurrency(bill.subTotal)} />
          <DefRow label="Total tax" value={formatCurrency(bill.totalTax)} />
          <DefRow label="Issue date" value={formatDate(bill.issueDate)} />
          <DefRow label="Received date" value={formatDate(bill.receivedDate)} />
          <DefRow label="Due date" value={formatDate(bill.dueDate)} />
          <DefRow label="Payment date" value={formatDate(bill.paymentDate)} />
        </SectionCard>
      </div>

      {(bill.comments || bill.declinedReason) && (
        <div className="grid gap-4 md:grid-cols-2">
          {bill.comments ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{bill.comments}</p>
              </CardContent>
            </Card>
          ) : null}
          {bill.declinedReason ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Declined Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{bill.declinedReason}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ActivitiesTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tasks and appointments linked to this bill will appear here once the
          activities API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function CommunicationsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Communications</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Emails and messages associated with this bill will appear here once
          the communications API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ bill }: { bill: Bill }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(bill.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(bill.updatedAt)} />
        <DefRow label="Created by (user id)" value={bill.createdByUserId ?? '—'} />
        <DefRow label="Updated by (user id)" value={bill.updatedByUserId ?? '—'} />
      </SectionCard>
    </div>
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
          Attachments linked to this bill will appear here once the attachments
          API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- container -------------------------------------------------------

type BillTab =
  | 'overview'
  | 'line-items'
  | 'activities'
  | 'communications'
  | 'timeline'
  | 'attachments';

type LineItemsUndoEntry = { kind: 'line-items'; edits: BillLineItemEdits };

export function BillDetail({ bill, job }: { bill: Bill; job?: Job | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<BillTab>('overview');
  const [lineItemsMounted, setLineItemsMounted] = useState(false);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [lineItemsSaving, setLineItemsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lineItemsEditTick, setLineItemsEditTick] = useState(0);
  const [undoStack, setUndoStack] = useState<LineItemsUndoEntry[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [returningToReceived, setReturningToReceived] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const lineItemsRef = useRef<BillLineItemsTabHandle | null>(null);
  const requireApprove = useRequirePermission('bills.approve', 'approve this bill');
  const requireReject = useRequirePermission('bills.reject', 'reject this bill');
  const requireManageProcurement = useRequirePermission(
    'procurement.manage',
    'update this bill',
  );

  const title = billDisplayTitle(bill);
  const status = billStatusName(bill);
  const isReceived = status === 'Received';
  const isReviewed = status === 'Reviewed';
  const isRejected = billIsRejected(bill);
  const hasPositiveAmount = billHasPositiveAmount(bill);
  const showApprove = isReceived;
  const approveEnabled = showApprove && hasPositiveAmount && !approving;
  const showReject = isReceived;
  const showEditBill = isReviewed || isRejected;
  const showMarkPaid = isReviewed || status === 'Approved';
  const canUndo = lineItemsDirty || undoStack.length > 0;

  useEffect(() => {
    setLineItemsDirty(false);
    setSaveError(null);
    setJustSaved(false);
    setUndoStack([]);
    setLineItemsMounted(tab === 'line-items');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount take-off for the new bill
  }, [bill.id]);

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
    (restoreEdits: BillLineItemEdits) => {
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
    if (!lineItemsDirty || lineItemsSaving) return;
    const timer = setTimeout(() => {
      saveLineItemsRef.current?.();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [lineItemsDirty, lineItemsSaving, lineItemsEditTick]);

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

  async function handleStatusChange(newStatus: string) {
    if (!requireManageProcurement()) return;
    setStatusLoading(true);
    const result = await updateBillStatusAction(bill.id, newStatus);
    if (!result.success) {
      console.error('[frontend:BillDetail.handleStatusChange]', result.error);
    }
    router.refresh();
    setStatusLoading(false);
  }

  async function handleApproveBill() {
    if (!requireApprove()) return;
    if (!approveEnabled) return;
    setApproving(true);
    try {
      const result = await approveBillAction(bill.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to approve bill');
        return;
      }
      toast.success('Bill approved');
      router.refresh();
    } catch (err) {
      console.error('[frontend:BillDetail.handleApproveBill]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to approve bill');
    } finally {
      setApproving(false);
    }
  }

  async function handleConfirmEditBill() {
    if (!requireManageProcurement()) return;
    if (!showEditBill || returningToReceived) return;
    setReturningToReceived(true);
    try {
      const result = await returnBillToReceivedAction(bill.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to return bill to received');
        return;
      }
      toast.success('Bill returned to received');
      setEditConfirmOpen(false);
      router.refresh();
    } catch (err) {
      console.error('[frontend:BillDetail.handleConfirmEditBill]', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to return bill to received',
      );
    } finally {
      setReturningToReceived(false);
    }
  }

  async function handleConfirmReject() {
    if (!requireReject()) return;
    if (!showReject || rejecting) return;
    setRejecting(true);
    try {
      const result = await rejectBillAction(bill.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to reject bill');
        return;
      }
      toast.success('Bill rejected');
      setRejectConfirmOpen(false);
      router.refresh();
    } catch (err) {
      console.error('[frontend:BillDetail.handleConfirmReject]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reject bill');
    } finally {
      setRejecting(false);
    }
  }

  const tabs: Array<{ id: BillTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'activities', label: 'Activities', icon: ClipboardList },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
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
        {showApprove && (
          <span
            title={
              hasPositiveAmount
                ? 'Approve Bill'
                : 'Add an amount greater than 0 to approve this bill'
            }
            className="inline-flex"
          >
            <Button
              size="default"
              disabled={!approveEnabled}
              className="h-9 gap-1.5 px-4 bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleApproveBill}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approving ? 'Approving…' : 'Approve Bill'}
            </Button>
          </span>
        )}
        {showReject && (
          <Button
            size="default"
            disabled={statusLoading || rejecting}
            className="h-9 gap-1.5 px-4 bg-red-600 text-white hover:bg-red-500"
            onClick={() => {
              if (!requireReject()) return;
              setRejectConfirmOpen(true);
            }}
          >
            Reject
          </Button>
        )}
        {showEditBill && (
          <Button
            size="default"
            disabled={returningToReceived}
            className="h-9 gap-1.5 px-4 bg-slate-700 text-white hover:bg-slate-600"
            onClick={() => {
              if (!requireManageProcurement()) return;
              setEditConfirmOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Bill
          </Button>
        )}
        {showMarkPaid && (
          <Button
            size="default"
            disabled={statusLoading}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            onClick={() => handleStatusChange('Paid')}
          >
            Mark Paid
          </Button>
        )}
        <HeaderActionToolbar>
          <DetailUndoButton
            canUndo={canUndo}
            undoDisabled={lineItemsSaving}
            onUndo={handleUndo}
          />
          <PrintButton documentType="bill" entityId={bill.id} jobId={job?.id} />
          <ArchiveEntityButton
            entityType="bill"
            entityId={bill.id}
            statusName={status}
            entityLabel={title}
            redirectTo={job ? `/bills?jobId=${job.id}` : '/bills'}
          />
        </HeaderActionToolbar>
      </SetHeaderActions>
      <Dialog
        open={editConfirmOpen}
        onOpenChange={(next) => {
          if (!returningToReceived) setEditConfirmOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Pencil className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Edit bill</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Editing this bill will set its status back to{' '}
                  <span className="font-medium text-foreground">Received</span>.
                  {isRejected
                    ? ' You can then approve or reject it again.'
                    : ' You will need to approve it again after making changes.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={returningToReceived}
              onClick={() => setEditConfirmOpen(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={returningToReceived}
              onClick={handleConfirmEditBill}
              className="h-9 px-4"
            >
              {returningToReceived ? 'Updating…' : 'Edit bill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={rejectConfirmOpen}
        onOpenChange={(next) => {
          if (!rejecting) setRejectConfirmOpen(next);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Reject bill</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Rejecting this bill will set its status to{' '}
                  <span className="font-medium text-foreground">Rejected</span>. You can use{' '}
                  <span className="font-medium text-foreground">Edit Bill</span> later to return it
                  to Received if the charge should be processed after all.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={rejecting}
              onClick={() => setRejectConfirmOpen(false)}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={rejecting}
              onClick={handleConfirmReject}
              className="h-9 px-4 bg-red-600 text-white hover:bg-red-500"
            >
              {rejecting ? 'Rejecting…' : 'Reject bill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                  ? 'border-rose-600 bg-rose-50 text-rose-600'
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
        {tab === 'overview' && <OverviewTab bill={bill} />}
        {lineItemsMounted && (
          <div className={tab === 'line-items' ? undefined : 'hidden'}>
            <BillLineItemsTab
              ref={lineItemsRef}
              bill={bill}
              onDirtyChange={handleLineItemsDirtyChange}
              onUndoCapture={handleLineItemsUndoCapture}
              onSaveStateChange={handleLineItemsSaveState}
              hideToolbarActions
            />
          </div>
        )}
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab bill={bill} />}
        {tab === 'attachments' && <AttachmentsTab />}
      </div>
    </div>
  );
}
