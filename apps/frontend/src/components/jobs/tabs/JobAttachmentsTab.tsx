'use client';

import { useEffect, useState } from 'react';
import { Paperclip, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchJobAttachmentsAction } from '@/app/(app)/jobs/[id]/actions';
import {
  formatDate,
  formatBytes,
  PhaseUnavailable,
} from '@/components/shared/detail';
import type { Attachment } from '@/types/api';

export function JobAttachmentsTab({ jobId }: { jobId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchJobAttachmentsAction(jobId);
      if (cancelled) return;
      setAttachments(res.data);
      setPhaseUnavailable(res.phaseUnavailable);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Attachments ({attachments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {attachments.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No attachments linked to this job.
          </p>
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
                      {a.fileUrl ? (
                        <a
                          href={a.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
