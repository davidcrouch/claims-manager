'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PackagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { capturePurchaseOrderAction } from '@/app/(app)/purchase-orders/capture-actions';

export interface CapturePoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  claimId?: string;
}

export function CapturePoDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
}: CapturePoDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Issuer fields
  const [issuerName, setIssuerName] = useState('');
  const [issuerAbn, setIssuerAbn] = useState('');
  const [issuerEmail, setIssuerEmail] = useState('');
  const [issuerPhone, setIssuerPhone] = useState('');

  // PO header fields
  const [poNumber, setPoNumber] = useState('');
  const [poName, setPoName] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [note, setNote] = useState('');

  const reset = useCallback(() => {
    setIssuerName('');
    setIssuerAbn('');
    setIssuerEmail('');
    setIssuerPhone('');
    setPoNumber('');
    setPoName('');
    setScopeOfWork('');
    setStartDate('');
    setEndDate('');
    setTotalAmount('');
    setNote('');
    setError(null);
    setSubmitting(false);
  }, []);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleSubmit() {
    if (!poNumber.trim()) {
      setError('PO Number is required');
      return;
    }
    if (!issuerName.trim() && !issuerAbn.trim() && !issuerEmail.trim()) {
      setError('At least one issuer identifier is required (name, ABN, or email)');
      return;
    }
    if (!jobId && !claimId) {
      setError('A job or claim association is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await capturePurchaseOrderAction({
        issuer: {
          legalName: issuerName || undefined,
          abn: issuerAbn || undefined,
          email: issuerEmail || undefined,
          phone: issuerPhone || undefined,
        },
        purchaseOrderNumber: poNumber.trim(),
        name: poName || undefined,
        scopeOfWork: scopeOfWork || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
        note: note || undefined,
        jobId,
        claimId,
      });

      if (result.success && result.data) {
        handleOpenChange(false);
        router.push(`/work-orders?highlight=${result.data.workOrderId}`);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to capture PO');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture PO');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = poNumber.trim() && (issuerName.trim() || issuerAbn.trim() || issuerEmail.trim());

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Capture External PO"
      description="Record a purchase order received from an external party"
      icon={<PackagePlus className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <div className="space-y-8">
          {/* Issuer Identity */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Issuer Details
            </h3>
            <p className="text-xs text-muted-foreground">
              Identify the organisation that issued this purchase order. At least one field is required.
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="issuer-name">Business Name</Label>
                <Input
                  id="issuer-name"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="e.g. Smith Constructions Pty Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer-abn">ABN</Label>
                <Input
                  id="issuer-abn"
                  value={issuerAbn}
                  onChange={(e) => setIssuerAbn(e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer-email">Email</Label>
                <Input
                  id="issuer-email"
                  type="email"
                  value={issuerEmail}
                  onChange={(e) => setIssuerEmail(e.target.value)}
                  placeholder="e.g. office@smithconstructions.com.au"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer-phone">Phone</Label>
                <Input
                  id="issuer-phone"
                  type="tel"
                  value={issuerPhone}
                  onChange={(e) => setIssuerPhone(e.target.value)}
                  placeholder="e.g. 0400 000 000"
                />
              </div>
            </div>
          </div>

          {/* PO Header */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Purchase Order Details
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="po-number">
                  PO Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="po-number"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="e.g. PO-2026-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-name">Name</Label>
                <Input
                  id="po-name"
                  value={poName}
                  onChange={(e) => setPoName(e.target.value)}
                  placeholder="Short description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total-amount">Total Amount ($)</Label>
                <Input
                  id="total-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope-of-work">Scope of Work</Label>
              <Textarea
                id="scope-of-work"
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="Describe the scope of work..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-note">Notes</Label>
              <Textarea
                id="po-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Capturing...
              </>
            ) : (
              'Capture PO'
            )}
          </Button>
        </div>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
