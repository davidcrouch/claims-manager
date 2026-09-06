'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
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
import { Checkbox } from '@/components/ui/checkbox';
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

type WizardStep = 'recipients' | 'create-report' | 'email';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'recipients', label: 'Recipients' },
  { key: 'create-report', label: 'Create Report' },
  { key: 'email', label: 'Send Email' },
];

type DocStatus = 'idle' | 'generating' | 'completed' | 'failed';
type DocFormat = 'pdf' | 'docx';

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
  const [createPdf, setCreatePdf] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);
  const [docStatus, setDocStatus] = useState<DocStatus>('idle');
  const [docFormat, setDocFormat] = useState<DocFormat>('docx');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRef = useRef(open);
  openRef.current = open;
  const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previewObjectUrlRef = useRef<string | null>(null);

  function revokePreviewObjectUrl() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }

  function resetDocumentState() {
    setGeneratedDocId(null);
    setDocStatus('idle');
    setDocFormat('docx');
    setPreviewUrl(null);
    setDocError(null);
    if (pollRef.current) clearTimeout(pollRef.current);
    revokePreviewObjectUrl();
  }

  // Reset state when the drawer opens
  useEffect(() => {
    if (!open) {
      setStep('recipients');
      setContacts([]);
      setContactDrawerOpen(false);
      setCreatePdf(false);
      setSubject('');
      setSubmitting(false);
      setError(null);
      resetDocumentState();
      return;
    }

    setSubject(rfqNumber ? `Request for Quotation: ${rfqNumber}` : 'Request for Quotation');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on open
  }, [open]);

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
          documentType: 'rfq',
          entityId: rfqId,
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
  }, [rfqId, createPdf]);

  // Poll for generation status once we have a generatedDocId
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
              // Word docs may still be usable as attachments even if preview URL fails.
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

  function handleCreatePdfChange(checked: boolean) {
    setCreatePdf(checked);
    if (docStatus !== 'idle') {
      resetDocumentState();
    }
  }

  const recipientsWithEmail = contacts.filter((c) => c.email);
  const recipientsWithoutEmail = contacts.filter((c) => !c.email);
  const canAdvanceFromRecipients = recipientsWithEmail.length > 0;
  const canAdvanceFromReport = docStatus === 'completed';

  function handleNext() {
    if (step === 'recipients' && canAdvanceFromRecipients) {
      setStep('create-report');
    } else if (step === 'create-report' && canAdvanceFromReport) {
      setStep('email');
    }
  }

  function handleBack() {
    if (step === 'email') setStep('create-report');
    else if (step === 'create-report') setStep('recipients');
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
              />
            )}
            {step === 'create-report' && (
              <StepCreateReport
                createPdf={createPdf}
                onCreatePdfChange={handleCreatePdfChange}
                docStatus={docStatus}
                docFormat={docFormat}
                previewUrl={previewUrl}
                docError={docError}
                onGenerate={() => void triggerDocumentGeneration()}
              />
            )}
            {step === 'email' && (
              <StepEmailPreview
                subject={subject}
                onSubjectChange={setSubject}
                recipients={recipientsWithEmail}
                rfqNumber={rfqNumber}
                docFormat={docFormat}
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
                disabled={submitting || docStatus === 'generating'}
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
            {step === 'create-report' && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canAdvanceFromReport}
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
}: {
  contacts: JobContactRef[];
  onAdd: (c: JobContactRef) => void;
  onRemove: (key: string) => void;
  onNewContact: () => void;
  recipientsWithoutEmail: JobContactRef[];
  jobId?: string | null;
}) {
  return (
    <div className="space-y-4">
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
/*  Step 2 — Create Report                                                    */
/* -------------------------------------------------------------------------- */

function DocumentGenerationErrorPanel({
  docError,
  onRetry,
}: {
  docError: string | null;
  onRetry: () => void;
}) {
  const hint = pdfErrorHint(docError);
  const detailLines = (docError ?? 'An unexpected error occurred while generating the document.')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-5" role="alert">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-100">
          <FileText className="h-7 w-7 text-red-600" />
        </div>
        <div className="max-w-xl">
          <p className="font-medium text-red-800">Document generation failed</p>
          <div className="mt-1 space-y-1 text-sm text-red-700">
            {detailLines.map((line, index) => (
              <p key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap wrap-break-word">
                {line}
              </p>
            ))}
          </div>
          {hint && <p className="mt-2 text-sm text-red-600/90">{hint}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCreateReport({
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
            id="rfq-send-create-pdf"
            checked={createPdf}
            disabled={generating}
            onCheckedChange={(checked) => onCreatePdfChange(!!checked)}
            className="mt-0.5"
          />
          <div className="min-w-0">
            <Label htmlFor="rfq-send-create-pdf" className="font-normal">
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
              Generate a {formatLabel.toLowerCase()} to attach to the RFQ email.
            </p>
          </div>
          <Button type="button" onClick={onGenerate} className="gap-1.5">
            <FileText className="h-4 w-4" />
            Generate {formatLabel}
          </Button>
        </div>
      )}

      {docStatus === 'generating' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          <div className="text-center">
            <p className="font-medium text-slate-700">Generating {formatLabel}…</p>
            <p className="mt-1 text-sm text-slate-500">This may take a few moments.</p>
          </div>
        </div>
      )}

      {docStatus === 'failed' && (
        <DocumentGenerationErrorPanel docError={docError} onRetry={onGenerate} />
      )}

      {docStatus === 'completed' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <Check className="h-4 w-4" />
              <span className="font-medium">
                {docFormat === 'pdf' ? 'PDF' : 'Word document'} generated successfully
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGenerate}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </div>

          {docFormat === 'pdf' && previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-[55vh] w-full rounded-md border border-slate-200"
              title="RFQ PDF Preview"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-10">
              <FileText className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">
                Word document ready to attach. Preview is available for PDF only.
              </p>
              {previewUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                >
                  Download Word document
                </Button>
              )}
            </div>
          )}
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
  docFormat,
}: {
  subject: string;
  onSubjectChange: (s: string) => void;
  recipients: JobContactRef[];
  rfqNumber?: string | null;
  docFormat: DocFormat;
}) {
  const attachmentName = `RFQ${rfqNumber ? `-${rfqNumber}` : ''}.${docFormat === 'pdf' ? 'pdf' : 'docx'}`;

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
          <span className="text-slate-700">{attachmentName}</span>
        </div>
      </div>
    </div>
  );
}
