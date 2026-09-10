'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Banknote, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SectionCard, formatCurrency, formatDateTime } from '@/components/shared/detail';
import type { Invoice, InvoicePayment } from '@/types/api';
import { invoiceAmountReceived, invoiceRemainingAmount } from '@/components/invoices/invoice-label';
import { updateInvoicePaymentAction, deleteInvoicePaymentAction } from '@/app/(app)/mutations';
import { useHasPermission } from '@/components/providers/PermissionsProvider';

function paymentAmount(payment: InvoicePayment): number {
  const amount = Number(payment.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function InvoicePaymentsTab({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const canUpdate = useHasPermission('invoices.update');
  const payments = invoice.payments ?? [];
  const received = invoiceAmountReceived(invoice);
  const remaining = invoiceRemainingAmount(invoice);
  const [editPayment, setEditPayment] = useState<InvoicePayment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletePayment, setDeletePayment] = useState<InvoicePayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openEdit(payment: InvoicePayment) {
    setEditAmount(paymentAmount(payment).toFixed(2));
    setEditPayment(payment);
  }

  async function handleSaveEdit() {
    if (!editPayment || saving) return;
    const amount = Math.round(Number(editAmount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a payment amount greater than 0');
      return;
    }
    setSaving(true);
    try {
      const result = await updateInvoicePaymentAction({
        invoiceId: invoice.id,
        paymentId: editPayment.id,
        amount,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update payment');
        return;
      }
      toast.success('Payment updated');
      setEditPayment(null);
      router.refresh();
    } catch (err) {
      console.error('[frontend:InvoicePaymentsTab.handleSaveEdit]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update payment');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletePayment || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteInvoicePaymentAction({
        invoiceId: invoice.id,
        paymentId: deletePayment.id,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete payment');
        return;
      }
      toast.success('Payment deleted');
      setDeletePayment(null);
      router.refresh();
    } catch (err) {
      console.error('[frontend:InvoicePaymentsTab.handleConfirmDelete]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SectionCard
      title="Payments"
      icon={<Banknote className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Recorded by</th>
              {canUpdate && <th className="w-24 px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={canUpdate ? 4 : 3}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-3 py-2 text-slate-700">
                    {formatDateTime(payment.receivedAt)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {formatCurrency(paymentAmount(payment))}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {payment.createdByName?.trim() || '—'}
                  </td>
                  {canUpdate && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={saving || deleting}
                          onClick={() => openEdit(payment)}
                          aria-label="Edit payment"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          disabled={saving || deleting}
                          onClick={() => setDeletePayment(payment)}
                          aria-label="Delete payment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr className="text-sm">
              <td className="px-3 py-2 font-medium text-slate-700">Total received</td>
              <td className="px-3 py-2 text-right font-medium text-slate-900">
                {formatCurrency(received)}
              </td>
              <td
                className="px-3 py-2 text-slate-500"
                colSpan={canUpdate ? 2 : 1}
              >
                Remaining {formatCurrency(remaining)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog
        open={editPayment !== null}
        onOpenChange={(next) => {
          if (!saving) setEditPayment(next ? editPayment : null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Pencil className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Edit payment</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Enter the revised amount for this payment. Invoice status updates from the
                  total received.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-2 px-1">
            <Label htmlFor="invoice-edit-payment-amount">Payment amount</Label>
            <Input
              id="invoice-edit-payment-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={editAmount}
              disabled={saving}
              onChange={(e) => setEditAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSaveEdit();
                }
              }}
            />
          </div>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setEditPayment(null)}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={handleSaveEdit}
              className="h-9 px-4 bg-blue-600 text-white hover:bg-blue-500"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletePayment !== null}
        onOpenChange={(next) => {
          if (!deleting) setDeletePayment(next ? deletePayment : null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Delete payment</DialogTitle>
                <DialogDescription className="mt-1">
                  Delete this {formatCurrency(deletePayment ? paymentAmount(deletePayment) : 0)}{' '}
                  payment? Invoice status will update from the remaining total.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeletePayment(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
