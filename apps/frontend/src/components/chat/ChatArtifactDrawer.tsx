'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Code, Copy, Download, FileText, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasArtifact } from '@/lib/ai/chat-types';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { Button } from '@/components/ui/button';

interface ChatArtifactDrawerProps {
  artifact: CanvasArtifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (artifactId: string, content: string) => void;
  companionChatOpen?: boolean;
}

/**
 * Right-side full-height drawer for markdown/code canvas artifacts opened from chat.
 */
export function ChatArtifactDrawer({
  artifact,
  open,
  onOpenChange,
  onSave,
  companionChatOpen = false,
}: ChatArtifactDrawerProps) {
  const [content, setContent] = useState(artifact?.content ?? '');
  const [isPreview, setIsPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (artifact) {
      setContent(artifact.content);
      setIsPreview(false);
      setHasChanges(false);
    }
  }, [artifact?.id, artifact?.content]);

  const handleSave = useCallback(async () => {
    if (!artifact || !onSave || !hasChanges) return;
    setIsSaving(true);
    try {
      await onSave(artifact.id, content);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [artifact, content, onSave, hasChanges]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void handleSave();
      }
    },
    [handleSave],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    const ext = artifact?.contentType === 'code' ? (artifact.language ?? 'txt') : 'md';
    const filename = `${artifact?.title ?? 'canvas'}.${ext}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, artifact]);

  if (!artifact) return null;

  const isCode = artifact.contentType === 'code';

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={artifact.title || 'Canvas'}
      description={
        artifact.language
          ? `${artifact.contentType ?? 'document'} · ${artifact.language}`
          : (artifact.contentType ?? 'document')
      }
      icon={
        isCode ? <Code className="h-5 w-5" /> : <FileText className="h-5 w-5" />
      }
      companionChatOpen={companionChatOpen}
    >
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
        <BottomFormDrawerBody className="!px-0 !py-0">
          {isPreview ? (
            <div className="prose prose-sm max-w-none p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setHasChanges(true);
              }}
              className={cn(
                'h-full min-h-[50vh] w-full resize-none p-6 font-mono text-sm text-slate-800 focus:outline-none',
                isCode && 'bg-slate-900 text-slate-200',
              )}
              spellCheck={!isCode}
            />
          )}
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
            {artifact.contentType === 'markdown' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreview((v) => !v)}
              >
                {isPreview ? 'Edit' : 'Preview'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              v{artifact.version}
              {hasChanges ? ' · unsaved' : ''}
            </span>
            {onSave && (
              <Button
                type="button"
                size="sm"
                disabled={!hasChanges || isSaving}
                onClick={() => void handleSave()}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </BottomFormDrawerFooter>
      </div>
    </BottomFormDrawer>
  );
}
