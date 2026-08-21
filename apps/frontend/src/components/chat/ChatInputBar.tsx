'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/ai/types';
import type { FilePart } from '@/lib/ai/chat-types';
import {
  CHAT_ACCEPTED_TYPES,
  type FileProcessingError,
} from '@/lib/ai/file-processing';
import { DocumentAttachMenu } from './DocumentAttachMenu';

interface ChatInputBarProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text?: string) => void;
  onStop: () => void;
  isLoading: boolean;
  isProcessingFiles?: boolean;
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  selectedFiles?: File[];
  fileErrors?: FileProcessingError[];
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onFilesSelected?: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile?: (index: number) => void;
  onAddFiles?: (files: File[]) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  pendingAttachmentParts?: FilePart[];
  onRemovePendingAttachment?: (index: number) => void;
  relatedRecordType?: string;
  relatedRecordId?: string;
  supportsVision?: boolean;
  visionError?: string | null;
  onClearVisionError?: () => void;
  onVisionBlocked?: (message: string) => void;
  onAttachDocument?: (part: FilePart) => void;
  isSpeechSupported?: boolean;
  isListening?: boolean;
  interimTranscript?: string;
  onToggleSpeech?: () => void;
  speechError?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mediaType, fileName }: { mediaType?: string; fileName?: string }) {
  const mime = mediaType ?? '';
  const name = (fileName ?? '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) {
    return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
  }
  if (mime.includes('spreadsheet') || mime.includes('csv') || /\.(csv|xlsx?)$/.test(name)) {
    return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />;
  }
  return <FileText className="h-3.5 w-3.5 text-slate-500" />;
}

function SelectedFileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-6 w-6 rounded object-cover" />
      ) : (
        <FileTypeIcon mediaType={file.type} fileName={file.name} />
      )}
      <span className="max-w-[120px] truncate">{file.name}</span>
      <span className="text-[10px] text-slate-400">{formatFileSize(file.size)}</span>
      <button type="button" onClick={onRemove} className="rounded p-0.5 hover:bg-slate-200">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ChatInputBar({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  isProcessingFiles = false,
  agents,
  selectedAgentId,
  onSelectAgent,
  selectedFiles = [],
  fileErrors = [],
  fileInputRef: externalFileInputRef,
  onFilesSelected,
  onRemoveFile,
  onAddFiles,
  inputRef,
  pendingAttachmentParts = [],
  onRemovePendingAttachment,
  relatedRecordType,
  relatedRecordId,
  supportsVision = true,
  visionError,
  onClearVisionError,
  onVisionBlocked,
  onAttachDocument,
  isSpeechSupported = false,
  isListening = false,
  interimTranscript = '',
  onToggleSpeech,
  speechError,
}: ChatInputBarProps) {
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = externalFileInputRef ?? internalFileInputRef;
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];
  const busy = isLoading || isProcessingFiles;
  const hasAttachments = selectedFiles.length > 0 || pendingAttachmentParts.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setShowAgentMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isSpeechSupported || !onToggleSpeech) return;
    function handleShiftSpaceMic(e: globalThis.KeyboardEvent) {
      if (e.key !== ' ' || !e.shiftKey) return;
      e.preventDefault();
      onToggleSpeech?.();
    }
    document.addEventListener('keydown', handleShiftSpaceMic);
    return () => document.removeEventListener('keydown', handleShiftSpaceMic);
  }, [isSpeechSupported, onToggleSpeech]);

  function handleFormSubmit(overrideText?: string) {
    const text = overrideText ?? input;
    if (busy || (!text.trim() && !hasAttachments)) return;
    onSubmit(text);
    if (inputRef?.current) {
      inputRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleFormSubmit(e.currentTarget.value);
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      if (!supportsVision && files.some((f) => f.type.startsWith('image/'))) {
        onVisionBlocked?.('This agent does not support image attachments.');
        return;
      }
      onAddFiles?.(files);
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    onClearVisionError?.();
    const files = Array.from(e.target.files ?? []);
    if (!supportsVision && files.some((f) => f.type.startsWith('image/'))) {
      onVisionBlocked?.('This agent does not support image attachments.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (onFilesSelected) {
      onFilesSelected(e);
      return;
    }
    if (files.length > 0) onAddFiles?.(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleTextareaInput(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.5)}px`;
  }

  const yourAgents = agents.filter((a) => a.visibility === 'private' || !a.visibility);
  const orgAgents = agents.filter((a) => a.visibility === 'org');
  const publicAgents = agents.filter((a) => a.visibility === 'public');

  function renderAgentGroup(label: string, list: Agent[]) {
    if (list.length === 0) return null;
    return (
      <div key={label}>
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {list.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => {
              onSelectAgent(agent.id);
              setShowAgentMenu(false);
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50',
              agent.id === selectedAgentId && 'bg-primary/5 font-medium text-primary',
            )}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: agent.avatarColor ?? '#64748b' }}
            >
              {agent.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{agent.name}</span>
              <span className="block truncate text-[10px] text-slate-400">
                {agent.provider} · {agent.model}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <input
          ref={fileInputRef}
          type="file"
          accept={CHAT_ACCEPTED_TYPES}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {speechError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="text-sm text-amber-700">Speech recognition: {speechError}</span>
          </div>
        )}

        {visionError && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{visionError}</p>
          </div>
        )}

        {fileErrors.length > 0 && (
          <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {fileErrors.map((e, i) => (
              <p key={i}>
                {e.fileName}: {e.reason}
              </p>
            ))}
          </div>
        )}

        {(selectedFiles.length > 0 || pendingAttachmentParts.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingAttachmentParts.map((part, idx) => (
              <div
                key={`pending-${part.filename ?? idx}`}
                className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800"
              >
                {part.mediaType?.startsWith('image/') && part.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={part.url} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <FileTypeIcon mediaType={part.mediaType} fileName={part.filename} />
                )}
                <span className="max-w-[120px] truncate">{part.filename ?? 'Attachment'}</span>
                <button
                  type="button"
                  onClick={() => onRemovePendingAttachment?.(idx)}
                  className="rounded p-0.5 hover:bg-blue-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedFiles.map((file, idx) => (
              <SelectedFileChip
                key={`${file.name}-${idx}`}
                file={file}
                onRemove={() => onRemoveFile?.(idx)}
              />
            ))}
          </div>
        )}

        {isListening && interimTranscript && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            <span className="text-xs italic text-slate-500">{interimTranscript}</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-200">
          <div className="flex items-start gap-1">
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  onClearVisionError?.();
                  fileInputRef.current?.click();
                }}
                disabled={busy}
                title={supportsVision ? 'Attach files' : 'Attach files (images disabled for this agent)'}
                className="h-8 w-8 shrink-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              {relatedRecordType && relatedRecordId && onAttachDocument && (
                <DocumentAttachMenu
                  relatedRecordType={relatedRecordType}
                  relatedRecordId={relatedRecordId}
                  onAttach={onAttachDocument}
                  disabled={busy}
                  supportsVision={supportsVision}
                  onVisionBlocked={onVisionBlocked}
                />
              )}
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                onInputChange(e.target.value);
                handleTextareaInput(e.target);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                hasAttachments ? 'Add a message or send files…' : 'Ask about claims, jobs, invoices…'
              }
              rows={1}
              className="max-h-[50vh] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              disabled={busy}
              aria-label="Chat message input"
            />

            <div className="flex shrink-0 items-center pt-0.5">
              {isSpeechSupported && onToggleSpeech && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={onToggleSpeech}
                  disabled={busy}
                  title={isListening ? 'Stop listening (Shift+Space)' : 'Voice input (Shift+Space)'}
                  className={cn('h-8 w-8 shrink-0', isListening && 'text-red-500')}
                >
                  {isListening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          <div className="relative mt-1 flex items-center justify-between" ref={agentMenuRef}>
            <button
              type="button"
              onClick={() => setShowAgentMenu(!showAgentMenu)}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: selectedAgent?.avatarColor ?? '#64748b' }}
              >
                {(selectedAgent?.name ?? 'A').slice(0, 1).toUpperCase()}
              </span>
              {selectedAgent?.name ?? 'Agent'}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showAgentMenu && (
              <div className="absolute bottom-full left-0 z-10 mb-1 max-h-72 min-w-[16rem] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {renderAgentGroup('Your agents', yourAgents)}
                {renderAgentGroup('Organisation', orgAgents)}
                {renderAgentGroup('Public', publicAgents)}
                {yourAgents.length + orgAgents.length + publicAgents.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400">
                    <Bot className="mr-1 inline h-3.5 w-3.5" />
                    No agents
                  </div>
                )}
              </div>
            )}

            {isLoading ? (
              <Button type="button" size="icon" variant="secondary" onClick={onStop} title="Stop" className="h-8 w-8">
                <Square className="h-4 w-4" />
              </Button>
            ) : isProcessingFiles ? (
              <Button type="button" size="icon" disabled title="Processing files" className="h-8 w-8">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={() => handleFormSubmit()}
                disabled={(!input.trim() && !hasAttachments) || isProcessingFiles}
                title="Send"
                className="h-8 w-8"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
