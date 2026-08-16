'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Mail,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import { formatDateTime } from '@/components/shared/detail';
import {
  fetchRfqSendRequestDetailAction,
  retryRfqSendRequestAction,
} from '@/app/(app)/rfqs/[id]/actions';
import type { RfqSendRequestDetail, RfqSendRequestRecipientDetail } from '@/lib/api-client';

const LOG = 'frontend:RequestBatchDetail';

function RecipientStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
  }
}

async function resolvePdfPreviewUrl(
  docId: string,
  revokePrevious: () => void,
  rememberObjectUrl: (url: string) => void,
): Promise<string> {
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

  const blob = await dlRes.blob();
  const objectUrl = URL.createObjectURL(blob);
  revokePrevious();
  rememberObjectUrl(objectUrl);
  return objectUrl;
}

export function RequestBatchDetail({
  rfqId,
  requestId,
  onBack,
}: {
  rfqId: string;
  requestId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<RfqSendRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [docDrawerOpen, setDocDrawerOpen] = useState(false);
  const pdfObjectUrlRef = useRef<string | null>(null);

  const revokePdfObjectUrl = useCallback(() => {
    if (pdfObjectUrlRef.current) {
      URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRfqSendRequestDetailAction(rfqId, requestId);
      if (result.success && result.data) {
        setDetail(result.data);
      } else {
        setError(result.error ?? 'Failed to load');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [rfqId, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const docId = detail?.generatedDocId;
    if (!docId) {
      setPdfUrl(null);
      setPdfError(null);
      setPdfLoading(false);
      revokePdfObjectUrl();
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    setPdfUrl(null);

    resolvePdfPreviewUrl(
      docId,
      revokePdfObjectUrl,
      (url) => {
        pdfObjectUrlRef.current = url;
      },
    )
      .then((url) => {
        if (!cancelled) {
          setPdfUrl(url);
          setPdfLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load RFQ document';
          console.error(`${LOG}.loadPdf — ${message}`);
          setPdfError(message);
          setPdfLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [detail?.generatedDocId, revokePdfObjectUrl]);

  useEffect(() => {
    return () => {
      revokePdfObjectUrl();
    };
  }, [revokePdfObjectUrl]);

  const failedRecipients = detail?.recipients.filter((r) => r.status === 'failed') ?? [];
  const hasFailures = failedRecipients.length > 0;

  async function handleRetry() {
    if (!detail || failedRecipients.length === 0) return;
    setRetrying(true);
    try {
      const result = await retryRfqSendRequestAction(rfqId, requestId, {
        recipients: failedRecipients.map((r) => ({
          recipientId: r.id,
          email: emailOverrides[r.id]?.trim() || undefined,
        })),
      });
      if (result.success) {
        toast.success('Retrying failed recipients...');
        setEmailOverrides({});
        void load();
      } else {
        toast.error(result.error ?? 'Retry failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !detail) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{error ?? 'Request not found'}</p>
          <Button size="sm" variant="outline" onClick={onBack} className="mt-3">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canOpenDoc = !!detail.generatedDocId && !!pdfUrl && !pdfError;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h3 className="text-sm font-semibold">Send Request Detail</h3>
          <p className="text-xs text-muted-foreground">{formatDateTime(detail.createdAt)}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {detail.emailSubject}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
            <div className="w-full min-w-0 space-y-1 text-sm sm:flex-1">
              <p className="text-muted-foreground">
                Reply-to: {detail.replyTo ?? '—'}
              </p>
              <p className="text-muted-foreground">
                Status: <span className="font-medium capitalize">{detail.status}</span>
              </p>
              {!detail.generatedDocId && (
                <p className="pt-1 text-xs text-muted-foreground">
                  No RFQ document is attached to this send request.
                </p>
              )}
              {pdfError && (
                <p className="pt-1 text-xs text-destructive">{pdfError}</p>
              )}
            </div>

            {detail.generatedDocId ? (
              pdfLoading ? (
                <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : pdfError ? null : (
                <button
                  type="button"
                  onClick={() => setDocDrawerOpen(true)}
                  disabled={!canOpenDoc}
                  className="group relative flex h-44 w-32 shrink-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Open RFQ document"
                >
                  <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50">
                    {pdfUrl ? (
                      <iframe
                        src={pdfUrl}
                        title="RFQ document thumbnail"
                        className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-[0.25] border-0"
                        tabIndex={-1}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-8 w-8 text-violet-500" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/90 via-transparent to-transparent" />
                  </div>
                  <div className="flex items-center justify-between gap-1 border-t border-slate-100 px-2 py-1.5">
                    <span className="truncate text-[11px] font-medium text-slate-700">RFQ.pdf</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-violet-600" />
                  </div>
                </button>
              )
            ) : null}

            {/* Spacer so thumbnail stays visually centered when meta text is on the left */}
            <div className="hidden sm:block sm:flex-1" aria-hidden />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Recipients ({detail.recipients.length})
            </CardTitle>
            {hasFailures && (
              <Button
                size="sm"
                onClick={handleRetry}
                disabled={retrying}
                className="h-8 gap-1.5 bg-violet-600 text-white hover:bg-violet-500"
              >
                {retrying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry Failed
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Recipient</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Error</th>
                  {hasFailures && <th className="px-4 py-2">Override Email</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {detail.recipients.map((r: RfqSendRequestRecipientDetail) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{r.recipientName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.recipientEmail}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <RecipientStatusIcon status={r.status} />
                        <span className="capitalize">{r.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-destructive max-w-50 truncate">
                      {r.errorMessage ?? '—'}
                    </td>
                    {hasFailures && (
                      <td className="px-4 py-2">
                        {r.status === 'failed' && (
                          <Input
                            placeholder="New email (optional)"
                            value={emailOverrides[r.id] ?? ''}
                            onChange={(e) =>
                              setEmailOverrides((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                            className="h-8 text-xs w-48"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <BottomFormDrawer
        open={docDrawerOpen}
        onOpenChange={setDocDrawerOpen}
        title="Request for Quotation"
        description="Document emailed with this send request"
        icon={<FileText className="h-5 w-5" />}
      >
        <BottomFormDrawerBody>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="h-[70vh] w-full rounded-md border border-slate-200"
              title="RFQ PDF"
            />
          ) : (
            <div className="flex h-[70vh] items-center justify-center rounded-md border border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">Loading document…</p>
            </div>
          )}
        </BottomFormDrawerBody>
      </BottomFormDrawer>
    </div>
  );
}
