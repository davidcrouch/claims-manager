'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileStack, Loader2, Search } from 'lucide-react';
import type { FilePart } from '@/lib/ai/chat-types';
import {
  getDocumentReadUrlForChat,
  listRelatedDocumentsForChat,
} from '@/app/(app)/chat/chat-documents';

interface DocumentOption {
  id: string;
  fileName: string | null;
  mimeType: string | null;
}

interface DocumentAttachMenuProps {
  relatedRecordType: string;
  relatedRecordId: string;
  onAttach: (part: FilePart) => void;
  disabled?: boolean;
  supportsVision?: boolean;
  onVisionBlocked?: (message: string) => void;
}

export function DocumentAttachMenu({
  relatedRecordType,
  relatedRecordId,
  onAttach,
  disabled,
  supportsVision = true,
  onVisionBlocked,
}: DocumentAttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listRelatedDocumentsForChat(relatedRecordType, relatedRecordId)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [open, relatedRecordType, relatedRecordId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleSelect = useCallback(
    async (doc: DocumentOption) => {
      const mime = doc.mimeType ?? '';
      if (!supportsVision && mime.startsWith('image/')) {
        onVisionBlocked?.('This agent does not support image attachments.');
        return;
      }
      setAttachingId(doc.id);
      try {
        const data = await getDocumentReadUrlForChat(doc.id);
        if (!data) return;
        onAttach({
          type: 'file',
          uri: data.uri,
          url: data.signedUrl,
          mediaType: data.mimeType,
          filename: data.fileName ?? doc.fileName ?? 'Document',
        });
        setOpen(false);
      } finally {
        setAttachingId(null);
      }
    },
    [onAttach, supportsVision, onVisionBlocked],
  );

  const filtered = documents.filter((doc) => {
    const name = (doc.fileName ?? '').toLowerCase();
    return name.includes(query.toLowerCase());
  });

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
        title="Attach from documents"
        aria-label="Attach from documents"
      >
        <FileStack className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="w-full text-xs outline-none"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">No documents found</p>
            ) : (
              filtered.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  disabled={attachingId === doc.id}
                  onClick={() => void handleSelect(doc)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  {attachingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />
                  ) : (
                    <FileStack className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  )}
                  <span className="truncate">{doc.fileName ?? 'Untitled document'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
