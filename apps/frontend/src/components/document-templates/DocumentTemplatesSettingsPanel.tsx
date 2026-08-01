'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DocumentTemplateSetting, FSDocument } from '@/lib/api-client';

interface DocumentTemplatesSettingsPanelProps {
  initialSettings: DocumentTemplateSetting[];
  docxDocuments: FSDocument[];
}

export function DocumentTemplatesSettingsPanel({
  initialSettings,
  docxDocuments,
}: DocumentTemplatesSettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingType, setSavingType] = useState<string | null>(null);

  async function refreshSettings() {
    const res = await fetch('/api/document-templates');
    if (!res.ok) throw new Error('Failed to refresh settings');
    const data = (await res.json()) as DocumentTemplateSetting[];
    setSettings(data);
  }

  async function handleAssign(documentType: string, filesystemDocumentId: string) {
    setSavingType(documentType);
    try {
      const res = await fetch(`/api/document-templates/${documentType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filesystemDocumentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to assign template');
      }
      await refreshSettings();
      toast.success('Template assigned');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign template');
    } finally {
      setSavingType(null);
    }
  }

  async function handleClear(documentType: string) {
    setSavingType(documentType);
    try {
      const res = await fetch(`/api/document-templates/${documentType}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to clear template');
      }
      await refreshSettings();
      toast.success('Template cleared');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear template');
    } finally {
      setSavingType(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-base font-semibold text-slate-900">Document Templates</h3>
          <p className="mt-1 text-sm text-slate-500">
            Assign a Word (.docx) file from the filesystem for each generation scenario.
            Upload templates in the{' '}
            <Link href="/documents" className="text-slate-900 underline underline-offset-2">
              Documents
            </Link>{' '}
            browser first.
          </p>
        </div>

        {docxDocuments.length === 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No .docx files found in the filesystem. Upload a Word template under Documents, then
            return here to assign it.
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {settings.map((row) => {
            const busy = savingType === row.documentType;
            const selectedId = row.filesystemDocument?.id ?? '';

            return (
              <li
                key={row.documentType}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-900">{row.label}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{row.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {row.filesystemDocument
                      ? `Current: ${row.filesystemDocument.fileName}`
                      : 'Not set'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={selectedId || undefined}
                    onValueChange={(value) => {
                      if (value) void handleAssign(row.documentType, value);
                    }}
                    disabled={busy || docxDocuments.length === 0}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select .docx…" />
                    </SelectTrigger>
                    <SelectContent>
                      {docxDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.fileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {row.filesystemDocument && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => void handleClear(row.documentType)}
                      aria-label={`Clear ${row.label} template`}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
