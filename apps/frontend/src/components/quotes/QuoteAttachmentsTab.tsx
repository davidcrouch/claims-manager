'use client';

import { useEffect, useState } from 'react';
import { Paperclip, Upload, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchQuoteAttachmentsAction } from '@/app/(app)/quotes/actions';
import {
  formatDate,
  formatBytes,
  PhaseUnavailable,
} from '@/components/shared/detail';
import type { Attachment } from '@/types/api';

export function QuoteAttachmentsTab({ quoteId }: { quoteId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchQuoteAttachmentsAction(quoteId);
      if (cancelled) return;
      setAttachments(res.data);
      setPhaseUnavailable(res.phaseUnavailable);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Attachments ({attachments.length})
        </CardTitle>
        <Button size="sm" variant="outline" disabled title="Upload will be available once the attachments API supports file upload">
          <Upload className="mr-1 h-3 w-3" />
          Upload
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {attachments.length === 0 ? (
          <div>
            <div className="mx-4 mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 py-8">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Drag & drop files here or click Upload
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                File upload will be available once the attachments API supports it
              </p>
            </div>
            <p className="px-4 text-sm text-muted-foreground">
              No attachments linked to this estimate.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Document type</th>
                  <th className="px-4 py-2">Filename</th>
                  <th className="px-4 py-2">Size</th>
                  <th className="px-4 py-2">Uploaded</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {attachments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">
                      {a.title ?? a.filename ?? a.id}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {a.documentType ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {a.filename ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatBytes(a.fileSize ?? null)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatDate(a.createdAt)}
                      {a.uploadedByName ? ` by ${a.uploadedByName}` : ''}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={`/api/attachments/${a.id}/download?disposition=inline`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
