'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  JobContactsPicker,
  contactFromCreated,
  type JobContactRef,
} from '@/components/forms/JobContactsPicker';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { createRfqSendRequestAction } from '@/app/(app)/rfqs/[id]/actions';
import type { Contact } from '@/types/api';

type WizardStep = 'recipients' | 'preview-pdf' | 'email';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'recipients', label: 'Recipients' },
  { key: 'preview-pdf', label: 'Preview PDF' },
  { key: 'email', label: 'Send Email' },
];

type PdfStatus = 'idle' | 'generating' | 'completed' | 'failed';

const LOG = 'frontend:SendRfqRequestDrawer';

function isTemplatePdfError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('template') ||
    lower.includes('loop tags') ||
    lower.includes('xtag') ||
    lower.includes('invalid xml') ||
    lower.includes('tag:') ||
    lower.includes('code: loop_') ||
    lower.includes('misplaced')
  );
}

function pdfErrorHint(message: string | null | undefined): string | null {
  if (!isTemplatePdfError(message)) return null;
  return 'Fix the RFQ Word template in Document Templates (check loop tags like {#scopes}/{/scopes} stay inside the same table), then retry.';
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      message?: string | string[];
      error?: string;
      errorMessage?: string;
    };
    if (typeof body.errorMessage === 'string' && body.errorMessage.trim()) {
      return body.errorMessage;
    }
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join('; ');
    }
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  } catch {
    // ignore non-JSON bodies
  }
  return `${fallback} (${res.status})`;
}

export interface SendRfqRequestDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfqId: string;
  rfqNumber?: string | null;
  jobId?: string | null;
  onSuccess?: () => void;
}

export function SendRfqRequestDrawer({
  open,
  onOpenChange,
  rfqId,
  rfqNumber,
  jobId,
  onSuccess,
}: SendRfqRequestDrawerProps) {
  const [step, setStep] = useState<WizardStep>('recipients');
  const [contacts, setContacts] = useState<JobContactRef[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRef = useRef(open);
  openRef.current = open;
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pdfObjectUrlRef = useRef<string | null>(null);

  function revokePdfObjectUrl() {
    if (pdfObjectUrlRef.current) {
      URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = null;
    }
  }

  // Reset state when the drawer opens
  useEffect(() => {
    if (!open) {
      setStep('recipients');
      setContacts([]);
      setContactDrawerOpen(false);
      setGeneratedDocId(null);
      setPdfStatus('idle');
      setPdfUrl(null);
      setPdfError(null);
      setSubject('');
      setSubmitting(false);
      setError(null);
      if (pollRef.current) clearTimeout(pollRef.current);
      revokePdfObjectUrl();
      return;
    }

    setSubject(rfqNumber ? `Request for Quotation: ${rfqNumber}` : 'Request for Quotation');
    triggerPdfGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on open
  }, [open]);

  const triggerPdfGeneration = useCallback(async () => {
    setPdfStatus('generating');
    setPdfError(null);
    setPdfUrl(null);
    setGeneratedDocId(null);
    revokePdfObjectUrl();
    try {
      const res = await fetch('/api/generated-documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Intentionally omit destinationCategoryId — PDF is for preview/email only
        // until Send, when the API best-effort files it into the job folder.
        body: JSON.stringify({ documentType: 'rfq', entityId: rfqId }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to start PDF generation'));
      }
      const data = await res.json();
      if (!openRef.current) return;
      setGeneratedDocId(data.generatedDocumentId ?? data.id);
    } catch (err) {
      if (!openRef.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to start PDF generation';
      console.error(`${LOG}.triggerPdfGeneration — ${message}`);
      setPdfStatus('failed');
      setPdfError(message);
    }
  }, [rfqId]);

  // Poll for PDF generation status once we have a generatedDocId
  useEffect(() => {
    if (!generatedDocId || !open) return;
    let cancelled = false;

    async function resolvePreviewUrl(docId: string): Promise<string> {
      const dlRes = await fetch(
        `/api/generated-documents/${docId}/download?disposition=inline`,
      );
      if (!dlRes.ok) throw new Error('Download URL fetch failed');

      const contentType = dlRes.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const dlData = (await dlRes.json()) as { url?: string };
        if (!dlData.url) throw new Error('Download URL missing');
        return dlData.url;
      }

      // Stream fallback: binary PDF — build a blob URL for iframe preview
      const blob = await dlRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      revokePdfObjectUrl();
      pdfObjectUrlRef.current = objectUrl;
      return objectUrl;
    }

    async function poll() {
      try {
        const res = await fetch(`/api/generated-documents/${generatedDocId}`);
        if (!res.ok) throw new Error(`Status check failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'completed') {
          try {
            const previewUrl = await resolvePreviewUrl(generatedDocId!);
            if (!cancelled) {
              setPdfUrl(previewUrl);
              setPdfStatus('completed');
            }
          } catch (err) {
            if (!cancelled) {
              setPdfStatus('failed');
              setPdfError(
                err instanceof Error ? err.message : 'Failed to load PDF preview',
              );
            }
          }
          return;
        }

        if (data.status === 'failed') {
          if (!cancelled) {
            const message =
              data.errorMessage ?? data.error ?? 'PDF generation failed';
            console.error(`${LOG}.poll — generation failed: ${message}`);
            setPdfStatus('failed');
            setPdfError(message);
          }
          return;
        }

        // Still processing — poll again
        if (!cancelled) {
          pollRef.current = setTimeout(poll, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to check PDF status';
          console.error(`${LOG}.poll — ${message}`);
          setPdfStatus('failed');
          setPdfError(message);
        }
      }
    }

    setPdfStatus('generating');
    poll();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [generatedDocId, open]);

  function handleOpenChange(next: boolean) {
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
  }

  function addContact(contact: JobContactRef) {
    setContacts((prev) => {
      if (contact.contactId && prev.some((c) => c.contactId === contact.contactId)) {
        return prev;
      }
      return [contact, ...prev];
    });
    setError(null);
  }

  function handleContactCreated(contact: Contact) {
    addContact(contactFromCreated(contact));
  }

  function removeContact(key: string) {
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }

  const recipientsWithEmail = contacts.filter((c) => c.email);
  const recipientsWithoutEmail = contacts.filter((c) => !c.email);
  const canAdvanceFromRecipients = recipientsWithEmail.length > 0;
  const canAdvanceFromPreview = pdfStatus === 'completed';

  function handleNext() {
    if (step === 'recipients' && canAdvanceFromRecipients) {
      setStep('preview-pdf');
    } else if (step === 'preview-pdf' && canAdvanceFromPreview) {
      setStep('email');
    }
  }

  function handleBack() {
    if (step === 'email') setStep('preview-pdf');
    else if (step === 'preview-pdf') setStep('recipients');
  }

  async function handleSend() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRfqSendRequestAction(rfqId, {
        recipients: recipientsWithEmail.map((c) => ({
          contactId: c.contactId,
          name: `${c.firstName} ${c.lastName ?? ''}`.trim(),
          email: c.email!,
        })),
        generatedDocumentId: generatedDocId!,
        emailSubject: subject,
      });
      if (result.success) {
        toast.success(`Sending RFQ to ${recipientsWithEmail.length} recipient${recipientsWithEmail.length === 1 ? '' : 's'}…`);
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError(result.error ?? 'Failed to send RFQ');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send RFQ');
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Send RFQ"
        description={rfqNumber ? `Send Request for Quotation ${rfqNumber}` : 'Send Request for Quotation'}
        icon={<Send className="h-5 w-5" />}
        preventClose={submitting}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Steps indicator */}
          <div className="border-b border-slate-200 px-12 py-4">
            <div className="flex items-center justify-center gap-0">
              {STEPS.map((s, i) => {
                const completed = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={s.key} className="flex items-center">
                    {i > 0 && (
                      <div
                        className={`h-px w-12 ${
                          i <= stepIndex ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                          completed
                            ? 'bg-emerald-500 text-white'
                            : active
                              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {completed ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          active ? 'text-emerald-700' : completed ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <BottomFormDrawerBody>
            {step === 'recipients' && (
              <StepRecipients
                contacts={contacts}
                onAdd={addContact}
                onRemove={removeContact}
                onNewContact={() => setContactDrawerOpen(true)}
                recipientsWithoutEmail={recipientsWithoutEmail}
                jobId={jobId}
                pdfStatus={pdfStatus}
                pdfError={pdfError}
                onRetryPdf={triggerPdfGeneration}
                onViewPdfError={() => setStep('preview-pdf')}
              />
            )}
            {step === 'preview-pdf' && (
              <StepPreviewPdf
                pdfStatus={pdfStatus}
                pdfUrl={pdfUrl}
                pdfError={pdfError}
                onRetry={triggerPdfGeneration}
              />
            )}
            {step === 'email' && (
              <StepEmailPreview
                subject={subject}
                onSubjectChange={setSubject}
                recipients={recipientsWithEmail}
                rfqNumber={rfqNumber}
              />
            )}
            <BottomFormDrawerError error={error} />
          </BottomFormDrawerBody>

          {/* Footer navigation */}
          <BottomFormDrawerFooter>
            {step !== 'recipients' ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
                className="mr-auto gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                className="mr-auto"
              >
                Cancel
              </Button>
            )}

            {step === 'recipients' && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canAdvanceFromRecipients}
                className="gap-1.5"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 'preview-pdf' && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canAdvanceFromPreview}
                className="gap-1.5"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 'email' && (
              <Button
                type="button"
                onClick={handleSend}
                disabled={submitting || !generatedDocId}
                className="gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send RFQ
                  </>
                )}
              </Button>
            )}
          </BottomFormDrawerFooter>
        </div>
      </BottomFormDrawer>

      <ContactFormDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        onSuccess={handleContactCreated}
        defaultTypeRef="contact-type-vendor"
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 1 — Recipients                                                       */
/* -------------------------------------------------------------------------- */

function StepRecipients({
  contacts,
  onAdd,
  onRemove,
  onNewContact,
  recipientsWithoutEmail,
  jobId,
  pdfStatus,
  pdfError,
  onRetryPdf,
  onViewPdfError,
}: {
  contacts: JobContactRef[];
  onAdd: (c: JobContactRef) => void;
  onRemove: (key: string) => void;
  onNewContact: () => void;
  recipientsWithoutEmail: JobContactRef[];
  jobId?: string | null;
  pdfStatus: PdfStatus;
  pdfError: string | null;
  onRetryPdf: () => void;
  onViewPdfError: () => void;
}) {
  return (
    <div className="space-y-4">
      {pdfStatus === 'failed' && (
        <PdfGenerationErrorPanel
          compact
          pdfError={pdfError}
          onRetry={onRetryPdf}
          secondaryAction={{ label: 'View details', onClick: onViewPdfError }}
        />
      )}
      {pdfStatus === 'generating' || pdfStatus === 'idle' ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Preparing RFQ PDF in the background…
        </div>
      ) : null}
      <JobContactsPicker
        contacts={contacts}
        onAdd={onAdd}
        onRemove={onRemove}
        onNewContact={onNewContact}
        excludeIds={jobId ? [] : []}
        description="Search and select contacts to receive this RFQ. Each recipient must have an email address."
        newContactLabel="Create New Contact"
        defaultTypeRefs={['contact-type-vendor']}
      />
      {recipientsWithoutEmail.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>{recipientsWithoutEmail.length}</strong> selected contact{recipientsWithoutEmail.length === 1 ? '' : 's'}{' '}
          {recipientsWithoutEmail.length === 1 ? 'does' : 'do'} not have an email address and will be
          skipped:{' '}
          {recipientsWithoutEmail.map((c) => `${c.firstName} ${c.lastName ?? ''}`.trim()).join(', ')}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — Preview PDF                                                      */
/* -------------------------------------------------------------------------- */

function PdfGenerationErrorPanel({
  pdfError,
  onRetry,
  compact = false,
  secondaryAction,
}: {
  pdfError: string | null;
  onRetry: () => void;
  compact?: boolean;
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const hint = pdfErrorHint(pdfError);
  const detailLines = (pdfError ?? 'An unexpected error occurred while generating the PDF.')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div
      className={`rounded-md border border-red-200 bg-red-50 ${
        compact ? 'px-3 py-3' : 'px-4 py-5'
      }`}
      role="alert"
    >
      <div className={`flex ${compact ? 'items-start gap-3' : 'flex-col items-center gap-4 text-center'}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-red-100 ${
            compact ? 'h-9 w-9' : 'h-14 w-14'
          }`}
        >
          {compact ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <FileText className="h-7 w-7 text-red-600" />
          )}
        </div>
        <div className={compact ? 'min-w-0 flex-1' : 'max-w-xl'}>
          <p className="font-medium text-red-800">PDF generation failed</p>
          <div className={`mt-1 space-y-1 text-sm text-red-700 ${compact ? 'text-left' : ''}`}>
            {detailLines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap wrap-break-word">
                {line}
              </p>
            ))}
          </div>
          {hint && (
            <p className="mt-2 text-sm text-red-600/90">{hint}</p>
          )}
          <div className={`mt-3 flex flex-wrap gap-2 ${compact ? '' : 'justify-center'}`}>
            <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
            {secondaryAction && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={secondaryAction.onClick}
                className="text-red-800 hover:bg-red-100 hover:text-red-900"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPreviewPdf({
  pdfStatus,
  pdfUrl,
  pdfError,
  onRetry,
}: {
  pdfStatus: PdfStatus;
  pdfUrl: string | null;
  pdfError: string | null;
  onRetry: () => void;
}) {
  if (pdfStatus === 'generating' || pdfStatus === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <div className="text-center">
          <p className="font-medium text-slate-700">Generating PDF…</p>
          <p className="mt-1 text-sm text-slate-500">This may take a few moments.</p>
        </div>
      </div>
    );
  }

  if (pdfStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <PdfGenerationErrorPanel pdfError={pdfError} onRetry={onRetry} />
      </div>
    );
  }

  // completed
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <Check className="h-4 w-4" />
        <span className="font-medium">PDF generated successfully</span>
      </div>
      {pdfUrl ? (
        <iframe
          src={pdfUrl}
          className="h-[60vh] w-full rounded-md border border-slate-200"
          title="RFQ PDF Preview"
        />
      ) : (
        <div className="flex h-[60vh] items-center justify-center rounded-md border border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500">Loading preview…</p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 3 — Email Preview                                                    */
/* -------------------------------------------------------------------------- */

function StepEmailPreview({
  subject,
  onSubjectChange,
  recipients,
  rfqNumber,
}: {
  subject: string;
  onSubjectChange: (s: string) => void;
  recipients: JobContactRef[];
  rfqNumber?: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="rfq-email-subject">Subject</Label>
        <Input
          id="rfq-email-subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Email subject"
        />
      </div>

      {/* Recipients */}
      <div className="space-y-2">
        <Label>Recipients</Label>
        <div className="flex flex-wrap gap-2">
          {recipients.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              {`${c.firstName} ${c.lastName ?? ''}`.trim()}
              <span className="text-slate-400">&lt;{c.email}&gt;</span>
            </span>
          ))}
        </div>
      </div>

      {/* Reply-to */}
      <div className="space-y-2">
        <Label>Reply-to</Label>
        <p className="text-sm text-muted-foreground">
          Replies will go to your organisation&apos;s default email address.
        </p>
      </div>

      {/* Email body */}
      <div className="space-y-2">
        <Label>Email body</Label>
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>Dear Recipient,</p>
          <br />
          <p>
            Please find attached our Request for Quotation
            {rfqNumber ? ` (${rfqNumber})` : ''}.
          </p>
          <br />
          <p>
            We would appreciate your quotation at your earliest convenience. If you have any
            questions regarding the scope of work, please do not hesitate to contact us.
          </p>
          <br />
          <p>Kind regards</p>
        </div>
      </div>

      {/* Attachment */}
      <div className="space-y-2">
        <Label>Attachment</Label>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <Paperclip className="h-4 w-4 text-slate-400" />
          <span className="text-slate-700">
            RFQ{rfqNumber ? `-${rfqNumber}` : ''}.pdf
          </span>
        </div>
      </div>
    </div>
  );
}
