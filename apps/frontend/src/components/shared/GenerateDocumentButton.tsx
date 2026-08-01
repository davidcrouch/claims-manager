'use client';

import { useState, useCallback } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { GeneratedDocument } from '@/lib/api-client';

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

interface Props {
  entityId: string;
  documentType: string;
}

async function postGenerate(body: {
  documentType: string;
  entityId: string;
}): Promise<GeneratedDocument> {
  const res = await fetch('/api/generated-documents/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Generation failed (${res.status})`);
  }
  return res.json();
}

async function pollStatus(id: string): Promise<GeneratedDocument> {
  const res = await fetch(`/api/generated-documents/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Failed to check status (${res.status})`);
  }
  return res.json();
}

async function openDownload(id: string): Promise<void> {
  const res = await fetch(`/api/generated-documents/${id}/download`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Failed to get download URL (${res.status})`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await res.json()) as { url?: string };
    if (!data.url) throw new Error('Download URL missing');
    window.open(data.url, '_blank');
    return;
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = '';
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GenerateDocumentButton({ entityId, documentType }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const record = await postGenerate({ documentType, entityId });

      let current = record;
      let attempts = 0;

      while (
        current.status !== 'completed' &&
        current.status !== 'failed' &&
        attempts < MAX_POLL_ATTEMPTS
      ) {
        await sleep(POLL_INTERVAL_MS);
        current = await pollStatus(current.id);
        attempts++;
      }

      if (current.status === 'failed') {
        throw new Error(current.errorMessage ?? 'Document generation failed');
      }

      if (current.status !== 'completed') {
        throw new Error('Document generation timed out');
      }

      await openDownload(current.id);
      toast.success('Document generated successfully');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Document generation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [entityId, documentType]);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={handleGenerate}
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="mr-1.5 h-3.5 w-3.5" />
      )}
      {loading ? 'Generating…' : 'Generate PDF'}
    </Button>
  );
}
