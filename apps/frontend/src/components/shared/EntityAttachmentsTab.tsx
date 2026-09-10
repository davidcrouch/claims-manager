'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  File,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  attachDocumentToEntityAction,
  fetchEntityAttachmentsAction,
} from '@/app/(app)/attachments/actions';
import { formatDate, formatBytes, PhaseUnavailable } from '@/components/shared/detail';
import { ProjectDocumentsPickerDrawer } from '@/components/documents/ProjectDocumentsPickerDrawer';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/types/api';

interface EntityAttachmentsTabProps {
  entityId: string;
  relatedRecordType: 'Job' | 'Quote' | 'Invoice' | string;
  jobId?: string | null;
  entityLabel?: string;
}

function attachmentFileName(a: Attachment): string {
  return a.fileName ?? a.filename ?? a.title ?? a.id;
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return FileSpreadsheet;
  }
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType === 'text/plain') {
    return FileText;
  }
  return File;
}

function getFileIconColor(mimeType?: string | null): string {
  if (!mimeType) return 'text-slate-500';
  if (mimeType.startsWith('image/')) return 'text-purple-500';
  if (mimeType.startsWith('video/')) return 'text-pink-500';
  if (mimeType.startsWith('audio/')) return 'text-orange-500';
  if (mimeType.includes('pdf')) return 'text-red-500';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-500';
  if (mimeType.includes('word')) return 'text-blue-500';
  return 'text-slate-500';
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const Icon = getFileIcon(attachment.mimeType);
  const iconColor = getFileIconColor(attachment.mimeType);
  const name = attachmentFileName(attachment);
  const pendingSync = attachment.attachmentMeta?.pendingCrunchworkSync === true;
  const thumbSrc = attachment.sourceDocumentId
    ? `/api/documents/${attachment.sourceDocumentId}/thumbnail`
    : null;
  const viewHref = `/api/attachments/${attachment.id}/download?disposition=inline`;
  const size =
    typeof attachment.fileSize === 'string'
      ? Number(attachment.fileSize)
      : (attachment.fileSize ?? null);

  return (
    <Card className="group relative flex flex-col overflow-hidden p-0 gap-0 transition-all hover:shadow-md">
      {pendingSync && (
        <Badge
          variant="secondary"
          className="absolute left-2 top-2 z-10 text-[10px]"
          title="Saved locally; will upload to Crunchwork when this record is synced"
        >
          Pending sync
        </Badge>
      )}
      <div className="relative aspect-[210/297] w-full overflow-hidden bg-slate-100">
        {thumbSrc && !thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={name}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <Icon className={cn('h-10 w-10', iconColor)} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="truncate text-sm font-medium text-slate-900" title={name}>
          {name}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{formatBytes(size)}</span>
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Eye className="h-3 w-3" />
            View
          </a>
        </div>
        {attachment.createdAt && (
          <p className="text-[11px] text-muted-foreground">{formatDate(attachment.createdAt)}</p>
        )}
      </div>
    </Card>
  );
}

export function EntityAttachmentsTab({
  entityId,
  relatedRecordType,
  jobId,
  entityLabel,
}: EntityAttachmentsTabProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchEntityAttachmentsAction(relatedRecordType, entityId);
    setAttachments(res.data);
    setPhaseUnavailable(res.phaseUnavailable);
  }, [entityId, relatedRecordType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const canAttach = Boolean(jobId);
  const label = entityLabel ?? 'this record';

  async function handleAttach(params: {
    documentIds: string[];
    documentTypeExternalReference?: string;
  }) {
    const errors: string[] = [];
    for (const documentId of params.documentIds) {
      const result = await attachDocumentToEntityAction({
        documentId,
        relatedRecordType,
        relatedRecordId: entityId,
        documentTypeExternalReference: params.documentTypeExternalReference,
      });
      if (!result.success) {
        errors.push(result.error ?? `Failed to attach ${documentId}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(
        errors.length === params.documentIds.length
          ? errors[0]
          : `Attached ${params.documentIds.length - errors.length} of ${params.documentIds.length}. ${errors[0]}`,
      );
    }
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Attachments ({attachments.length})
            {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={!canAttach}
            title={
              canAttach
                ? 'Attach a document from the project repository'
                : 'Link a job to attach documents from the project repository'
            }
            onClick={() => {
              setPickerOpen(true);
            }}
          >
            <Paperclip className="mr-1 h-3 w-3" />
            Attach Item
          </Button>
        </CardHeader>
        <CardContent>
          {!canAttach && (
            <p className="mb-3 text-xs text-muted-foreground">
              Attach Item requires a linked job so documents can be selected from the project
              repository.
            </p>
          )}
          {attachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 py-10">
              <Paperclip className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No attachments linked to {label}.</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Use Attach Item to select files from the project documents repository.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {attachments.map((a) => (
                <AttachmentCard key={a.id} attachment={a} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {jobId && (
        <ProjectDocumentsPickerDrawer
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          jobId={jobId}
          relatedRecordType={relatedRecordType}
          showDocumentTypeField={relatedRecordType === 'Job'}
          onConfirm={handleAttach}
        />
      )}
    </>
  );
}
