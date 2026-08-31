'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { useApiClient } from '@/hooks/useApiClient';
import { usePageContext } from '@/lib/ai/use-page-context';

export interface JournalImageViewerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  journalId?: string;
  caption?: string;
  prompt?: string;
  companionChatOpen?: boolean;
  [key: string]: unknown;
}

export function JournalImageViewerDrawer({
  open,
  onOpenChange,
  documentId: documentIdProp,
  journalId: journalIdProp,
  caption,
  prompt,
  companionChatOpen = false,
}: JournalImageViewerDrawerProps) {
  const api = useApiClient();
  const pageContext = usePageContext();

  const documentId = useMemo(() => {
    const raw = typeof documentIdProp === 'string' ? documentIdProp.trim() : '';
    return raw || '';
  }, [documentIdProp]);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId || !open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getDocumentDownloadUrl(documentId)
      .then((res) => {
        if (cancelled) return;
        if (res.downloadUrl) {
          setImageSrc(res.downloadUrl);
        } else {
          setImageSrc(`/api/v1/documents/${documentId}/stream`);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setImageSrc(`/api/v1/documents/${documentId}/stream`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, documentId, open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Inspection photo"
      description={prompt?.trim() || undefined}
      icon={<ImageIcon className="h-5 w-5" />}
      companionChatOpen={companionChatOpen}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          {!documentId && (
            <p className="py-8 text-center text-sm text-slate-500">
              No document selected.
            </p>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          )}

          {imageSrc && !loading && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={imageSrc}
                alt={caption || 'Inspection photo'}
                className="max-h-[60vh] w-full rounded-lg border border-slate-200 object-contain"
                onError={() => setError('Failed to load image')}
              />
              {caption && (
                <p className="text-sm text-slate-600">{caption}</p>
              )}
            </div>
          )}
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Done
          </Button>
        </BottomFormDrawerFooter>
      </div>
    </BottomFormDrawer>
  );
}
