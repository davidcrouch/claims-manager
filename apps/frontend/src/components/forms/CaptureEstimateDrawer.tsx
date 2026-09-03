'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileInput, Loader2 } from 'lucide-react';
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
import { captureEstimateAction } from '@/app/(app)/quotes/capture-actions';
import { resolveJobKindCaps } from '@/lib/job-kind-registry';

export interface CaptureEstimateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  claimId?: string;
  rfqId?: string;
  /** Parent job provider — CW quotes show Reference. */
  jobProvider?: string | null;
}

export function CaptureEstimateDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
  rfqId,
  jobProvider,
}: CaptureEstimateDrawerProps) {
  const router = useRouter();
  const showReference = useMemo(
    () => resolveJobKindCaps({ provider: jobProvider }).estimate.reference.visible,
    [jobProvider],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [issuerName, setIssuerName] = useState('');
  const [issuerAbn, setIssuerAbn] = useState('');
  const [issuerEmail, setIssuerEmail] = useState('');
  const [issuerPhone, setIssuerPhone] = useState('');

  const [quoteNumber, setQuoteNumber] = useState('');
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [note, setNote] = useState('');

  const reset = useCallback(() => {
    setIssuerName('');
    setIssuerAbn('');
    setIssuerEmail('');
    setIssuerPhone('');
    setQuoteNumber('');
    setName('');
    setReference('');
    setQuoteDate('');
    setExpiresInDays('');
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
    if (!name.trim()) {
      setError('Name is required');
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
      const result = await captureEstimateAction({
        issuer: {
          legalName: issuerName || undefined,
          abn: issuerAbn || undefined,
          email: issuerEmail || undefined,
          phone: issuerPhone || undefined,
        },
        quoteNumber: quoteNumber.trim() || undefined,
        name: name.trim(),
        reference: showReference && reference ? reference : undefined,
        quoteDate: quoteDate || undefined,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
        note: note || undefined,
        jobId,
        claimId,
        rfqId,
      });

      if (result.success && result.data) {
        handleOpenChange(false);
        router.push(`/proposals/${result.data.proposalId}`);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to capture estimate');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture estimate');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    name.trim() && (issuerName.trim() || issuerAbn.trim() || issuerEmail.trim());

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Capture External Estimate"
      description="Record an estimate received from an external (non-subscribed) vendor"
      icon={<FileInput className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Issuer Details</h3>
            <p className="text-xs text-muted-foreground">
              Identify the vendor that issued this estimate. At least one field is required.
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="est-issuer-name">Business Name</Label>
                <Input
                  id="est-issuer-name"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="e.g. Smith Constructions Pty Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-issuer-abn">ABN</Label>
                <Input
                  id="est-issuer-abn"
                  value={issuerAbn}
                  onChange={(e) => setIssuerAbn(e.target.value)}
                  placeholder="e.g. 12 345 678 901"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-issuer-email">Email</Label>
                <Input
                  id="est-issuer-email"
                  type="email"
                  value={issuerEmail}
                  onChange={(e) => setIssuerEmail(e.target.value)}
                  placeholder="e.g. office@smithconstructions.com.au"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-issuer-phone">Phone</Label>
                <Input
                  id="est-issuer-phone"
                  type="tel"
                  value={issuerPhone}
                  onChange={(e) => setIssuerPhone(e.target.value)}
                  placeholder="e.g. 0400 000 000"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Estimate Details</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="est-number">Estimate Number</Label>
                <Input
                  id="est-number"
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  placeholder="e.g. EST-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="est-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Short description"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-date">Estimate Date</Label>
                <Input
                  id="est-date"
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-expires">Expires In (days)</Label>
                <Input
                  id="est-expires"
                  type="number"
                  min="0"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-total">Total Amount ($)</Label>
                <Input
                  id="est-total"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {showReference && (
                <div className="space-y-2">
                  <Label htmlFor="est-reference">Reference</Label>
                  <Input
                    id="est-reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Optional reference"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="est-note">Notes</Label>
              <Textarea
                id="est-note"
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
        <Button variant="outline" size="lg" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button size="lg" onClick={handleSubmit} disabled={submitting || !canSubmit}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Capturing...
            </>
          ) : (
            'Capture Estimate'
          )}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
