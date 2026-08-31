import type { GeneratedDocument } from '@/lib/api-client';

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 90;

export interface GenerateDocumentParams {
  documentType: string;
  entityId?: string;
  templateId?: string;
  filesystemDocumentId?: string;
  destinationCategoryId?: string;
  /** When false, skip PDF conversion and return the filled Word file. Defaults to true. */
  createPdf?: boolean;
}

export interface GenerateDocumentResult {
  savedToFolder: boolean;
  format: 'pdf' | 'docx';
}

async function postGenerate(body: GenerateDocumentParams): Promise<GeneratedDocument> {
  const res = await fetch('/api/generated-documents/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Generation failed (${res.status})`,
    );
  }
  return res.json();
}

async function pollStatus(id: string): Promise<GeneratedDocument> {
  const res = await fetch(`/api/generated-documents/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Failed to check status (${res.status})`,
    );
  }
  return res.json();
}

async function openDownload(id: string): Promise<void> {
  const res = await fetch(`/api/generated-documents/${id}/download`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Failed to get download URL (${res.status})`,
    );
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
  const disposition = res.headers.get('content-disposition') ?? '';
  const named = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
  a.download = named?.[1] ? decodeURIComponent(named[1].replace(/"/g, '')) : '';
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

/** Generate a PDF via the document-templating subsystem, poll until ready, then download or save. */
export async function generateAndDownloadDocument(
  params: GenerateDocumentParams,
): Promise<GenerateDocumentResult> {
  const record = await postGenerate(params);
  if (!record?.id) {
    throw new Error('Generation did not return a document id');
  }

  let current = record;
  let attempts = 0;

  while (
    current.status !== 'completed' &&
    current.status !== 'failed' &&
    attempts < MAX_POLL_ATTEMPTS
  ) {
    if (attempts > 0) await sleep(POLL_INTERVAL_MS);
    current = await pollStatus(current.id);
    attempts++;
  }

  if (current.status === 'failed') {
    throw new Error(current.errorMessage ?? 'Document generation failed');
  }

  if (current.status !== 'completed') {
    throw new Error('Document generation timed out');
  }

  const savedToFolder = Boolean(params.destinationCategoryId);
  const format: 'pdf' | 'docx' = current.s3KeyPdf?.trim() ? 'pdf' : 'docx';
  if (!savedToFolder) {
    await openDownload(current.id);
  }
  return { savedToFolder, format };
}
