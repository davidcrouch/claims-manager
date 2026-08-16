'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/components/shared/detail';
import { fetchRfqSendRequestsAction } from '@/app/(app)/rfqs/[id]/actions';
import { RequestBatchDetail } from './RequestBatchDetail';
import { SendRfqRequestDrawer } from './SendRfqRequestDrawer';
import type { RfqSendRequestListItem } from '@/lib/api-client';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'partial':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'success':
      return 'Sent';
    case 'partial':
      return 'Partial';
    case 'failed':
      return 'Failed';
    case 'pending':
      return 'Sending...';
    default:
      return status;
  }
}

function statusBgClass(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-50 border-green-200';
    case 'partial':
      return 'bg-amber-50 border-amber-200';
    case 'failed':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
}

export function RequestsTab({
  rfqId,
  rfqNumber,
  jobId,
  sendDrawerOpen,
  onSendDrawerOpenChange,
}: {
  rfqId: string;
  rfqNumber?: string | null;
  jobId?: string | null;
  sendDrawerOpen: boolean;
  onSendDrawerOpenChange: (open: boolean) => void;
}) {
  const [requests, setRequests] = useState<RfqSendRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRfqSendRequestsAction(rfqId);
      if (result.success && result.data) {
        setRequests(result.data);
      } else {
        setError(result.error ?? 'Failed to load send requests');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSendSuccess = useCallback(() => {
    void load();
  }, [load]);

  if (selectedRequestId) {
    return (
      <>
        <RequestBatchDetail
          rfqId={rfqId}
          requestId={selectedRequestId}
          onBack={() => {
            setSelectedRequestId(null);
            void load();
          }}
        />
        <SendRfqRequestDrawer
          open={sendDrawerOpen}
          onOpenChange={onSendDrawerOpenChange}
          rfqId={rfqId}
          rfqNumber={rfqNumber}
          jobId={jobId}
          onSuccess={handleSendSuccess}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Send requests ({requests.length})
      </h3>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">No requests sent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Send Request&rdquo; to send this RFQ to vendors via email.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <button
              key={req.id}
              type="button"
              onClick={() => setSelectedRequestId(req.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/30 ${statusBgClass(req.status)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusIcon status={req.status} />
                    <span className="text-sm font-medium">{statusLabel(req.status)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(req.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-14 overflow-hidden">
                    {req.recipients.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center rounded-full bg-white/80 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {r.recipientName}
                      </span>
                    ))}
                    {req.recipientCount > req.recipients.length && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-muted-foreground">
                        +{req.recipientCount - req.recipients.length} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-muted-foreground">
                    {req.recipientCount} recipient{req.recipientCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <SendRfqRequestDrawer
        open={sendDrawerOpen}
        onOpenChange={onSendDrawerOpenChange}
        rfqId={rfqId}
        rfqNumber={rfqNumber}
        jobId={jobId}
        onSuccess={handleSendSuccess}
      />
    </div>
  );
}
