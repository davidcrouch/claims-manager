'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Loader2,
  Mail,
  Receipt,
  RefreshCw,
  Send,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatCurrency, formatDate } from '@/components/shared/detail';
import {
  PublishEntityContext,
  PublishSummaryCard,
  PublishSummaryRow,
} from '@/components/shared/PublishEntityContext';
import { publishInvoiceAction } from '@/app/(app)/mutations';
import { createInvoiceSendRequestAction } from '@/app/(app)/invoices/actions';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { invoiceStatusName } from '@/components/invoices/invoice-label';
import { workOrderInsurerPo } from '@/components/work-orders/work-order-label';
import type { Claim, Invoice, Job, PurchaseOrder, WorkOrder } from '@/types/api';

export type InvoicePublishMode = 'internal' | 'external' | 'email';

type WizardStep = 'confirm' | 'create-report' | 'email';
type DocStatus = 'idle' | 'generating' | 'completed' | 'failed';
type DocFormat = 'pdf' | 'docx';

const EMAIL_STEPS: Array<{ key: WizardStep; label: string }> = [
  { key: 'confirm', label: 'Confirm' },
  { key: 'create-report', label: 'Create report' },
  { key: 'email', label: 'Send email' },
];

const LOG = 'frontend:InvoicePublishWizard';

function pdfErrorHint(message: string | null): string | null {
  if (!message) return null;
  if (/timeout|timed out/i.test(message)) {
    return 'Generation timed out. Try again, or generate Word only (PDF off).';
  }
  if (/template|not found/i.test(message)) {
    return 'Check that an Invoice document template is configured for your organisation.';
  }
  return null;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export interface InvoicePublishWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  job?: Job | null;
  claim?: Claim | null;
  workOrder?: WorkOrder | null;
  purchaseOrder?: PurchaseOrder | null;
  mode: InvoicePublishMode;
}

export function InvoicePublishWizard({
  open,
  onOpenChange,
  invoice,
  job,
  claim,
  workOrder,
  purchaseOrder,
  mode,
}: InvoicePublishWizardProps) {
  const router = useRouter();
  const isEmail = mode === 'email';
  const isInternal = mode === 'internal';

  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email-path wizard state
  const [step, setStep] = useState<WizardStep>('confirm');
  const [createPdf, setCreatePdf] = useState(false);
  const [subject, setSubject] = useState('');
  const [docStatus, setDocStatus] = useState<DocStatus>('idle');
  const [docError, setDocError] = useState<string | null>(null);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);
  const [docFormat, setDocFormat] = useState<DocFormat>('pdf');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const invoiceNumber = entityDisplayLabel(
    invoice.internalNumber,
    invoice.invoiceNumber,
  );
  const recipientName =
    invoice.recipientContact?.name?.trim() ||
    invoice.recipientContact?.email ||
    'Recipient';
  const recipientEmail = invoice.recipientContact?.email?.trim() || '';

  const revokePreviewObjectUrl = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  const resetDocumentState = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
    revokePreviewObjectUrl();
    setDocStatus('idle');
    setDocError(null);
    setGeneratedDocId(null);
    setPreviewUrl(null);
    setDocFormat(createPdf ? 'pdf' : 'docx');
  }, [createPdf, revokePreviewObjectUrl]);

  const reset = useCallback(() => {
    setPublishing(false);
    setSubmitting(false);
    setError(null);
    setStep('confirm');
    setCreatePdf(false);
    setSubject('');
    resetDocumentState();
  }, [resetDocumentState]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setSubject(
      invoiceNumber ? `Invoice: ${invoiceNumber}` : 'Invoice',
    );
  }, [open, invoiceNumber, reset]);

  const triggerDocumentGeneration = useCallback(async () => {
    setDocStatus('generating');
    setDocError(null);
    setPreviewUrl(null);
    setGeneratedDocId(null);
    setDocFormat(createPdf ? 'pdf' : 'docx');
    revokePreviewObjectUrl();
    try {
      const res = await fetch('/api/generated-documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Intentionally omit destinationCategoryId — file is for preview/email only
        // until Send, when the API best-effort files it into the job folder.
        body: JSON.stringify({
          documentType: 'invoice',
          entityId: invoice.id,
          createPdf,
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to start document generation'));
      }
      const data = await res.json();
      if (!openRef.current) return;
      setGeneratedDocId(data.generatedDocumentId ?? data.id);
    } catch (err) {
      if (!openRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to start document generation';
      console.error(`${LOG}.triggerDocumentGeneration — ${message}`);
      setDocStatus('failed');
      setDocError(message);
    }
  }, [invoice.id, createPdf, revokePreviewObjectUrl]);

  useEffect(() => {
    if (!generatedDocId || !open) return;
    let cancelled = false;

    async function resolvePreviewUrl(docId: string, format: DocFormat): Promise<string> {
      const qs = new URLSearchParams({ disposition: 'inline', format });
      const dlRes = await fetch(`/api/generated-documents/${docId}/download?${qs.toString()}`);
      if (!dlRes.ok) throw new Error('Download URL fetch failed');

      const contentType = dlRes.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const dlData = (await dlRes.json()) as { url?: string };
        if (!dlData.url) throw new Error('Download URL missing');
        return dlData.url;
      }

      const blob = await dlRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      revokePreviewObjectUrl();
      previewObjectUrlRef.current = objectUrl;
      return objectUrl;
    }

    async function poll() {
      try {
        const res = await fetch(`/api/generated-documents/${generatedDocId}`);
        if (!res.ok) throw new Error(`Status check failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'completed') {
          const format: DocFormat = data.s3KeyPdf?.trim() ? 'pdf' : 'docx';
          try {
            const url = await resolvePreviewUrl(generatedDocId!, format);
            if (!cancelled) {
              setDocFormat(format);
              setPreviewUrl(url);
              setDocStatus('completed');
            }
          } catch (err) {
            if (!cancelled) {
              if (format === 'docx') {
                setDocFormat(format);
                setPreviewUrl(null);
                setDocStatus('completed');
              } else {
                setDocStatus('failed');
                setDocError(
                  err instanceof Error ? err.message : 'Failed to load document preview',
                );
              }
            }
          }
          return;
        }

        if (data.status === 'failed') {
          if (!cancelled) {
            const message =
              data.errorMessage ?? data.error ?? 'Document generation failed';
            console.error(`${LOG}.poll — generation failed: ${message}`);
            setDocStatus('failed');
            setDocError(message);
          }
          return;
        }

        if (!cancelled) {
          pollRef.current = setTimeout(poll, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to check document status';
          console.error(`${LOG}.poll — ${message}`);
          setDocStatus('failed');
          setDocError(message);
        }
      }
    }

    setDocStatus('generating');
    poll();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [generatedDocId, open, revokePreviewObjectUrl]);

  function handleOpenChange(next: boolean) {
    if (publishing || submitting) return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleConfirmPublish() {
    setPublishing(true);
    setError(null);
    try {
      const result = await publishInvoiceAction(invoice.id);
      if (!result.success) {
        setError(
          result.error ??
            (isInternal
              ? 'Failed to publish invoice'
              : 'Failed to send invoice to Insurer'),
        );
        return;
      }

      toast.success(
        isInternal ? 'Invoice published' : 'Invoice sent to Insurer',
      );
      onOpenChange(false);
      reset();
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  function handleNext() {
    setError(null);
    if (step === 'confirm') {
      if (!recipientEmail) {
        setError('Recipient contact must have an email address');
        return;
      }
      setStep('create-report');
      return;
    }
    if (step === 'create-report' && docStatus === 'completed') {
      setStep('email');
    }
  }

  function handleBack() {
    setError(null);
    if (step === 'email') setStep('create-report');
    else if (step === 'create-report') setStep('confirm');
  }

  async function handleSendEmail() {
    if (!generatedDocId || !recipientEmail) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createInvoiceSendRequestAction(invoice.id, {
        recipients: [
          {
            contactId: invoice.recipientContactId ?? invoice.recipientContact?.id,
            name: recipientName,
            email: recipientEmail,
          },
        ],
        generatedDocumentId: generatedDocId,
        emailSubject: subject,
      });
      if (result.success) {
        toast.success(`Invoice emailed to ${recipientEmail}`);
        onOpenChange(false);
        reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to email invoice');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to email invoice');
    } finally {
      setSubmitting(false);
    }
  }

  const statusName = invoiceStatusName(invoice);
  const workOrderNumber = entityDisplayLabel(workOrder?.internalNumber);
  const purchaseOrderNumber =
    purchaseOrder?.purchaseOrderNumber?.trim() ||
    (workOrder ? workOrderInsurerPo(workOrder) : undefined) ||
    '—';
  const stepIndex = EMAIL_STEPS.findIndex((s) => s.key === step);
  const busy = publishing || submitting;

  if (isEmail) {
    return (
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Email invoice"
        description="Generate the invoice document and email it to the recipient."
        icon={<Mail className="h-5 w-5 text-blue-600" />}
        preventClose={busy}
      >
        <div className="border-b border-slate-200 px-12 py-3">
          <ol className="flex flex-wrap gap-2 text-xs">
            {EMAIL_STEPS.map((s, i) => (
              <li
                key={s.key}
                className={`rounded-full px-3 py-1 ${
                  i === stepIndex
                    ? 'bg-slate-900 text-white'
                    : i < stepIndex
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i + 1}. {s.label}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <BottomFormDrawerBody>
            <div className="mx-auto max-w-2xl space-y-4">
              {step === 'confirm' && (
                <>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-950">
                    <p className="font-medium">This invoice will be emailed and locked</p>
                    <p className="mt-2 text-blue-900/80">
                      A document will be generated from the invoice template and emailed
                      to the recipient. Status will change to Invoiced and the invoice
                      will be locked.
                    </p>
                  </div>
                  <PublishSummaryCard title="Invoice summary">
                    <PublishSummaryRow label="Invoice number" value={invoiceNumber} />
                    <PublishSummaryRow label="Status" value={statusName} />
                    <PublishSummaryRow
                      label="Total"
                      value={formatCurrency(invoice.totalAmount)}
                    />
                    <PublishSummaryRow
                      label="Recipient"
                      value={`${recipientName}${recipientEmail ? ` <${recipientEmail}>` : ''}`}
                    />
                    <PublishSummaryRow
                      label="Recipient type"
                      value={
                        invoice.recipientType === 'other' ? 'Other' : 'Insured'
                      }
                    />
                  </PublishSummaryCard>
                  <PublishEntityContext job={job} claim={claim} />
                </>
              )}

              {step === 'create-report' && (
                <EmailCreateReportStep
                  createPdf={createPdf}
                  onCreatePdfChange={(checked) => {
                    setCreatePdf(checked);
                    if (docStatus !== 'idle') resetDocumentState();
                  }}
                  docStatus={docStatus}
                  docFormat={docFormat}
                  previewUrl={previewUrl}
                  docError={docError}
                  onGenerate={() => void triggerDocumentGeneration()}
                />
              )}

              {step === 'email' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 space-y-3">
                    <div>
                      <Label>To</Label>
                      <p className="mt-1 text-sm text-slate-800">
                        {recipientName}
                        {recipientEmail ? (
                          <span className="text-muted-foreground"> · {recipientEmail}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-email-subject">Subject</Label>
                      <Input
                        id="invoice-email-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The generated {docFormat === 'pdf' ? 'PDF' : 'Word'} invoice will be
                      attached.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <BottomFormDrawerError error={error} />
          </BottomFormDrawerBody>

          <BottomFormDrawerFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() =>
                step === 'confirm' ? handleOpenChange(false) : handleBack()
              }
            >
              {step === 'confirm' ? 'Cancel' : 'Back'}
            </Button>
            {step === 'email' ? (
              <Button
                type="button"
                size="lg"
                disabled={busy || !subject.trim() || !generatedDocId}
                onClick={() => void handleSendEmail()}
                className="bg-blue-600 text-white hover:bg-blue-500"
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                {submitting ? 'Sending…' : 'Send invoice'}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={
                  busy ||
                  (step === 'create-report' && docStatus !== 'completed')
                }
                onClick={handleNext}
              >
                Next
              </Button>
            )}
          </BottomFormDrawerFooter>
        </div>
      </BottomFormDrawer>
    );
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isInternal ? 'Publish invoice' : 'Publish invoice to Insurer'}
      description={
        isInternal
          ? 'Review the claim, job, and invoice summary, then publish. It will be locked afterwards.'
          : 'Review the claim, job, and invoice summary, then send this invoice to Insurer.'
      }
      icon={
        isInternal ? (
          <Receipt className="h-5 w-5 text-amber-600" />
        ) : (
          <Shield className="h-5 w-5 text-amber-600" />
        )
      }
      preventClose={publishing}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-2xl space-y-4">
          {isInternal ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This invoice will be locked after publish</p>
              <p className="mt-2 text-amber-900/80">
                Status will change to Invoiced. Invoice details cannot be edited
                afterwards.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">This will be pushed to Insurer</p>
              <p className="mt-2 text-amber-900/80">
                Submitting creates the invoice in Crunchwork for Insurer against the
                linked work order. Status will change to Invoiced and the invoice
                will be locked. This cannot be undone from this screen.
              </p>
            </div>
          )}

          <PublishSummaryCard title="Invoice summary">
            <PublishSummaryRow label="Invoice number" value={invoiceNumber} />
            <PublishSummaryRow label="Status" value={statusName} />
            <PublishSummaryRow
              label="Total"
              value={formatCurrency(invoice.totalAmount)}
            />
            <PublishSummaryRow
              label="Issue date"
              value={invoice.issueDate ? formatDate(invoice.issueDate) : '—'}
            />
            <PublishSummaryRow label="Work order" value={workOrderNumber} />
            <PublishSummaryRow label="Purchase order" value={purchaseOrderNumber} />
          </PublishSummaryCard>

          <PublishEntityContext job={job} claim={claim} />
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={publishing}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={publishing}
          onClick={() => void handleConfirmPublish()}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          {publishing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isInternal ? (
            <FileText className="mr-1.5 h-4 w-4" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          {publishing
            ? isInternal
              ? 'Publishing…'
              : 'Sending to Insurer…'
            : isInternal
              ? 'Publish invoice'
              : 'Submit to Insurer'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}

function EmailCreateReportStep({
  createPdf,
  onCreatePdfChange,
  docStatus,
  docFormat,
  previewUrl,
  docError,
  onGenerate,
}: {
  createPdf: boolean;
  onCreatePdfChange: (checked: boolean) => void;
  docStatus: DocStatus;
  docFormat: DocFormat;
  previewUrl: string | null;
  docError: string | null;
  onGenerate: () => void;
}) {
  const generating = docStatus === 'generating';
  const formatLabel = createPdf ? 'PDF' : 'Word document';

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
        <div className="flex items-start gap-2">
          <Checkbox
            id="invoice-email-create-pdf"
            checked={createPdf}
            disabled={generating}
            onCheckedChange={(checked) => onCreatePdfChange(!!checked)}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <Label htmlFor="invoice-email-create-pdf" className="font-normal">
              Generate PDF
            </Label>
            <p className="mt-0.5 text-xs text-slate-500">
              Off by default — generates a Word document. Turn on to convert to PDF.
            </p>
          </div>
        </div>
      </div>

      {docStatus === 'idle' && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12">
          <FileText className="h-10 w-10 text-slate-400" />
          <div className="text-center">
            <p className="font-medium text-slate-700">Ready to create report</p>
            <p className="mt-1 text-sm text-slate-500">
              Generate a {formatLabel.toLowerCase()} to attach to the invoice email.
            </p>
          </div>
          <Button type="button" onClick={onGenerate} className="gap-1.5">
            <FileText className="h-4 w-4" />
            Generate {formatLabel}
          </Button>
        </div>
      )}

      {docStatus === 'generating' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">Generating {formatLabel.toLowerCase()}…</p>
        </div>
      )}

      {docStatus === 'failed' && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-5" role="alert">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="h-7 w-7 text-red-600" />
            <div className="max-w-xl">
              <p className="font-medium text-red-800">Document generation failed</p>
              <p className="mt-1 text-sm text-red-700 whitespace-pre-wrap">
                {docError ?? 'An unexpected error occurred.'}
              </p>
              {pdfErrorHint(docError) && (
                <p className="mt-2 text-sm text-red-600/90">{pdfErrorHint(docError)}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGenerate}
                className="mt-3 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {docStatus === 'completed' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-800">
            {docFormat === 'pdf' ? 'PDF' : 'Word document'} ready
          </p>
          {previewUrl ? (
            <iframe
              title="Invoice preview"
              src={previewUrl}
              className="h-80 w-full rounded-md border border-slate-200 bg-white"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview unavailable; the file will still be attached to the email.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
