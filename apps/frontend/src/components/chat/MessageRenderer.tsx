'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Image as ImageIcon,
  PanelRight,
  Pencil,
  RefreshCw,
  Settings,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ChatMessage, ChatPart, CanvasArtifact } from '@/lib/ai/chat-types';
import {
  buildAttachmentUrlMap,
  parseVisionBlock,
  resolveVisionImageUrl,
} from '@/lib/ai/vision-block';
import { cn } from '@/lib/utils';
import { ToolInvocation } from './ToolInvocation';
import { ImageLightbox } from './ImageLightbox';
import { ImageAnnotation } from './ImageAnnotation';
import { InlineChart, isChartSpec } from './InlineChart';

export interface AgentAvatarInfo {
  name: string;
  avatarColor?: string;
}

interface MessageRendererProps {
  message: ChatMessage;
  allMessages?: ChatMessage[];
  agentInfo?: AgentAvatarInfo;
  isStreaming?: boolean;
  isInterrupted?: boolean;
  conversationId?: string;
  onOpenCanvas?: (artifact: CanvasArtifact) => void;
  onFeedback?: (messageId: string, rating: 'positive' | 'negative') => void;
  existingRating?: 'positive' | 'negative' | null;
  onInspect?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
}

function isVisionResult(result: unknown): result is {
  imageUrl: string;
  annotations: Array<{
    label: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
} {
  if (!result || typeof result !== 'object') return false;
  const r = result as Record<string, unknown>;
  return typeof r.imageUrl === 'string' && Array.isArray(r.annotations);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sanitizeStreamingMarkdown(text: string, isStreaming: boolean): string {
  if (!isStreaming) return text;

  let result = text;

  const fenceCount = (result.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    result += '\n```';
  }

  const boldCount = (result.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    result += '**';
  }

  const stripped = result.replace(/\*\*/g, '');
  const italicCount = (stripped.match(/\*/g) || []).length;
  if (italicCount % 2 !== 0) {
    result += '*';
  }

  const backtickCount = (result.match(/(?<!`)`(?!`)/g) || []).length;
  if (backtickCount % 2 !== 0) {
    result += '`';
  }

  return result;
}

function findToolResult(
  parts: ChatPart[],
  toolCallId: string,
): { result: unknown; isError?: boolean } | null {
  const resultPart = parts.find(
    (p) => p.type === 'tool-result' && p.toolCallId === toolCallId,
  );
  if (!resultPart || resultPart.type !== 'tool-result') return null;
  return { result: resultPart.result, isError: resultPart.isError };
}

const messageTimestamps = new Map<string, number>();

export function MessageRenderer({
  message,
  allMessages,
  agentInfo,
  isStreaming,
  isInterrupted,
  onOpenCanvas,
  onFeedback,
  existingRating,
  onInspect,
  onRegenerate,
  onEdit,
  onBranch,
}: MessageRendererProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; filename?: string } | null>(null);
  const attachmentUrlMap = useMemo(
    () => buildAttachmentUrlMap(allMessages ?? [message]),
    [allMessages, message],
  );
  const openLightbox = useCallback((src: string, alt: string, filename?: string) => {
    setLightbox({ src, alt, filename });
  }, []);

  if (!messageTimestamps.has(message.id)) {
    messageTimestamps.set(message.id, Date.now());
  }
  const createdMs = message.createdAt
    ? new Date(message.createdAt).getTime()
    : messageTimestamps.get(message.id)!;
  const messageTime = new Date(Number.isFinite(createdMs) ? createdMs : messageTimestamps.get(message.id)!);

  const agentName = agentInfo?.name ?? 'AI';
  const initials = agentName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const hasVisibleText = message.parts.some(
    (p) => p.type === 'text' && p.text,
  );

  return (
    <>
      <div
        className={cn('group flex w-full gap-3', isUser && 'justify-end')}
        role="article"
        aria-label={`${isUser ? 'You' : agentName} message`}
      >
        {isAssistant && (
          <div className="mt-1 flex shrink-0 flex-col items-center gap-1">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
              style={{
                background: agentInfo?.avatarColor
                  ?? 'linear-gradient(to bottom right, #3b82f6, #4f46e5)',
              }}
            >
              {initials || 'AI'}
            </div>
            <span className="max-w-[80px] text-center text-[10px] font-medium leading-tight text-slate-500">
              {agentName}
            </span>
          </div>
        )}

        <div className={cn('max-w-[85%] space-y-1', isUser && 'max-w-[75%]')}>
          {isAssistant && isStreaming && !hasVisibleText && (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex space-x-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-400">Thinking…</span>
            </div>
          )}

          {message.parts.map((part, idx) => {
            if (part.type === 'text' && part.text) {
              const isErrorMessage = message.metadata?.error === true;
              return (
                <div
                  key={idx}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : isErrorMessage
                        ? 'border border-red-200 bg-red-50 text-red-800'
                        : 'bg-slate-100 text-slate-900',
                  )}
                >
                  {isErrorMessage ? (
                    <>
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Could not complete request</span>
                      </div>
                      <p className="text-sm">{part.text}</p>
                    </>
                  ) : isAssistant ? (
                    <div className="max-w-none text-sm leading-relaxed text-slate-800">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => <h1 className="mb-2 mt-3 text-lg font-semibold text-slate-800">{children}</h1>,
                          h2: ({ children }) => <h2 className="mb-2 mt-3 text-base font-semibold text-slate-800">{children}</h2>,
                          h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-sm font-semibold text-slate-800">{children}</h3>,
                          p: ({ children }) => <p className="my-1.5">{children}</p>,
                          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
                          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
                          li: ({ children }) => <li className="my-0.5">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          blockquote: ({ children }) => (
                            <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600">
                              {children}
                            </blockquote>
                          ),
                          table: ({ children }) => (
                            <div className="my-2 overflow-x-auto">
                              <table className="w-full border-collapse text-xs">{children}</table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-slate-200 px-2 py-1">{children}</td>
                          ),
                          a: ({ href, children, ...props }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline hover:text-blue-800"
                              {...props}
                            >
                              {children}
                            </a>
                          ),
                          img: ({ src, alt }) => {
                            if (!src || typeof src !== 'string') return null;
                            return (
                              <button
                                type="button"
                                onClick={() => openLightbox(src, alt ?? 'Image')}
                                className="my-2 block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={alt ?? 'Image'}
                                  className="max-h-64 max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                                />
                              </button>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                          code: ({ children, className, ...props }) => {
                            const isBlock = className?.startsWith('language-');
                            if (isBlock) {
                              if (className === 'language-chart') {
                                try {
                                  const parsed = JSON.parse(String(children));
                                  if (isChartSpec(parsed)) {
                                    return <InlineChart spec={parsed} />;
                                  }
                                } catch {
                                  /* fall through */
                                }
                              }
                              if (className === 'language-vision') {
                                const spec = parseVisionBlock(String(children));
                                if (spec) {
                                  const imageUrl = resolveVisionImageUrl(spec, attachmentUrlMap);
                                  if (imageUrl) {
                                    return (
                                      <ImageAnnotation
                                        imageUrl={imageUrl}
                                        annotations={spec.annotations}
                                      />
                                    );
                                  }
                                }
                              }
                              return <CodeBlock className={className}>{children}</CodeBlock>;
                            }
                            return (
                              <code
                                className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-800"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {sanitizeStreamingMarkdown(part.text, !!isStreaming)}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-slate-600" />
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{part.text}</p>
                  )}
                </div>
              );
            }

            if (part.type === 'reasoning') {
              return <ReasoningBlock key={idx} text={part.text} />;
            }

            if (part.type === 'file') {
              const mediaType = part.mediaType ?? '';
              const filename = part.filename ?? 'Attachment';

              if (mediaType.startsWith('image/') && part.url) {
                return (
                  <div key={idx} className="my-1">
                    <button
                      type="button"
                      onClick={() => openLightbox(part.url, filename, filename)}
                      className="block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={part.url}
                        alt={filename}
                        className="max-h-64 max-w-full rounded-lg border border-slate-200 object-contain shadow-sm transition hover:opacity-90"
                      />
                    </button>
                    <p className="mt-1 text-[10px] text-slate-400">{filename}</p>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="my-1 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
                >
                  <MessageFileIcon mediaType={mediaType} fileName={filename} />
                  <span className="truncate text-xs text-blue-800">{filename}</span>
                </div>
              );
            }

            if (part.type === 'tool-call') {
              const toolResult = findToolResult(message.parts, part.toolCallId);
              const visionResult =
                part.state === 'complete' && toolResult?.result && isVisionResult(toolResult.result)
                  ? toolResult.result
                  : null;
              return (
                <div key={part.toolCallId}>
                  <ToolInvocation
                    toolName={part.toolName}
                    args={part.args}
                    state={part.state}
                    result={toolResult?.result}
                    onOpenCanvas={onOpenCanvas}
                  />
                  {visionResult ? (
                    <ImageAnnotation
                      imageUrl={visionResult.imageUrl}
                      annotations={visionResult.annotations}
                    />
                  ) : null}
                </div>
              );
            }

            if (part.type === 'canvas-action') {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    onOpenCanvas?.({
                      id: part.artifactId,
                      title: part.title,
                      contentType: part.contentType,
                      content: part.content ?? '',
                      language: part.language,
                      version: part.version ?? 1,
                    })
                  }
                  className="my-2 flex w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-800 hover:bg-blue-100"
                >
                  <PanelRight className="h-4 w-4" />
                  Open canvas: {part.title}
                </button>
              );
            }

            if (part.type === 'canvas-component') {
              return (
                <div
                  key={idx}
                  className="my-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800"
                >
                  Canvas component: {part.component}
                </div>
              );
            }

            if (part.type === 'citation') {
              return (
                <div
                  key={idx}
                  className="mt-2 inline-flex items-center gap-1 rounded bg-white/70 px-2 py-1 text-xs text-slate-600"
                >
                  <FileText className="h-3 w-3" />
                  {part.entityName} ({part.entityType})
                </div>
              );
            }

            return null;
          })}

          {isInterrupted && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-amber-700">Response interrupted</span>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {isUser && (
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <CopyButton message={message} compact />
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(message.id)}
                  className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                  title="Edit message"
                  aria-label="Edit message"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {onBranch && (
                <button
                  type="button"
                  onClick={() => onBranch(message.id)}
                  className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                  title="Branch conversation from here"
                  aria-label="Branch conversation from here"
                >
                  <GitBranch className="h-3 w-3" />
                </button>
              )}
              <span className="text-[10px] text-slate-300" title={messageTime.toLocaleString()}>
                {formatRelativeTime(messageTime)}
              </span>
            </div>
          )}

          {isAssistant && !isStreaming && (() => {
            const messageText = message.parts
              .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map((p) => p.text)
              .join('\n\n');
            if (!messageText) return null;
            const confidence = calculateConfidence(message);

            return (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {onRegenerate && (
                  <button
                    type="button"
                    onClick={() => onRegenerate(message.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
                    title="Regenerate response"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </button>
                )}
                <CopyButton message={message} />
                <SpeakButton text={messageText} />
                {onFeedback && (
                  <MessageFeedback
                    messageId={message.id}
                    existingRating={existingRating}
                    onFeedback={onFeedback}
                  />
                )}
                {onInspect && (
                  <button
                    type="button"
                    onClick={() => onInspect(message.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
                    title="Inspect audit data for this message"
                  >
                    <Settings className="h-3 w-3" />
                    Inspect
                  </button>
                )}
                {onBranch && (
                  <button
                    type="button"
                    onClick={() => onBranch(message.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
                    title="Branch conversation from here"
                  >
                    <GitBranch className="h-3 w-3" />
                    Branch
                  </button>
                )}
                {confidence !== null && <ConfidenceIndicator score={confidence} />}
                <span className="ml-auto text-[10px] text-slate-300" title={messageTime.toLocaleString()}>
                  {formatRelativeTime(messageTime)}
                </span>
              </div>
            );
          })()}
        </div>

        {isUser && (
          <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 shadow-sm">
            U
          </div>
        )}
      </div>

      <ImageLightbox
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        src={lightbox?.src ?? ''}
        alt={lightbox?.alt ?? 'Image'}
        filename={lightbox?.filename}
      />
    </>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-purple-100"
        aria-expanded={expanded}
      >
        <p className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
          Thinking
        </p>
        <span className="text-[10px] text-purple-400">
          {expanded ? 'Collapse' : 'Expand'}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-purple-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-purple-400" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-purple-200 px-3 py-2">
          <p className="whitespace-pre-wrap text-xs text-purple-700">{text}</p>
        </div>
      )}
    </div>
  );
}

function SpeakButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && !!window.speechSynthesis);
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = useCallback(() => {
    if (!supported) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [text, isSpeaking, supported]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      title={isSpeaking ? 'Stop reading' : 'Read aloud'}
      aria-label={isSpeaking ? 'Stop reading' : 'Read aloud'}
    >
      {isSpeaking ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function calculateConfidence(message: ChatMessage): number | null {
  if (message.role !== 'assistant') return null;

  const parts = message.parts ?? [];
  const textParts = parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text');
  const toolParts = parts.filter((p) => p.type === 'tool-call' || p.type === 'tool-result');

  let score = 0.7;

  if (toolParts.length > 0) score += 0.15;
  if (toolParts.length > 2) score += 0.05;

  const totalText = textParts.map((p) => p.text).join('');
  if (totalText.length < 50) score -= 0.1;

  const hedgeWords = ['might', 'perhaps', 'not sure', 'I think', 'possibly', 'may be', "I'm not certain"];
  const lowerText = totalText.toLowerCase();
  const hedgeCount = hedgeWords.filter((w) => lowerText.includes(w)).length;
  score -= hedgeCount * 0.05;

  return Math.max(0.1, Math.min(1.0, score));
}

function ConfidenceIndicator({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? 'text-green-500' : score >= 0.6 ? 'text-yellow-500' : 'text-red-400';
  const bg = score >= 0.8 ? 'bg-green-500' : score >= 0.6 ? 'bg-yellow-500' : 'bg-red-400';

  return (
    <div className="flex items-center gap-1" title={`Confidence: ${pct}%`}>
      <div className="h-1.5 w-8 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn('h-full rounded-full transition-all duration-300', bg)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-[10px]', color)}>{pct}%</span>
    </div>
  );
}

function CopyButton({ message, compact }: { message: ChatMessage; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
        title={copied ? 'Copied' : 'Copy message'}
        aria-label={copied ? 'Copied' : 'Copy message'}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
      title="Copy message"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function MessageFeedback({
  messageId,
  existingRating,
  onFeedback,
}: {
  messageId: string;
  existingRating?: 'positive' | 'negative' | null;
  onFeedback: (messageId: string, rating: 'positive' | 'negative') => void;
}) {
  const [rating, setRating] = useState<'positive' | 'negative' | null | undefined>(existingRating);

  useEffect(() => {
    setRating(existingRating);
  }, [existingRating]);

  const submitFeedback = (newRating: 'positive' | 'negative') => {
    if (rating === newRating) return;
    setRating(newRating);
    onFeedback(messageId, newRating);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => submitFeedback('positive')}
        className={cn(
          'flex items-center justify-center rounded p-0.5 transition-colors',
          rating === 'positive' ? 'text-green-500' : 'text-slate-400 hover:text-slate-600',
        )}
        title="Good response"
        aria-label="Good response"
      >
        <ThumbsUp className={cn('h-3 w-3', rating === 'positive' && 'fill-current')} />
      </button>
      <button
        type="button"
        onClick={() => submitFeedback('negative')}
        className={cn(
          'flex items-center justify-center rounded p-0.5 transition-colors',
          rating === 'negative' ? 'text-red-500' : 'text-slate-400 hover:text-slate-600',
        )}
        title="Bad response"
        aria-label="Bad response"
      >
        <ThumbsDown className={cn('h-3 w-3', rating === 'negative' && 'fill-current')} />
      </button>
    </div>
  );
}

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') ?? '';

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-slate-200">
      {language && (
        <div className="flex items-center justify-between bg-slate-800 px-4 py-1.5">
          <span className="text-xs text-slate-400">{language}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-white"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <pre className={cn('overflow-x-auto bg-slate-900 p-4 text-xs text-slate-200', !language && 'rounded-lg')}>
        <code>{children}</code>
      </pre>
      {!language && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded bg-slate-700 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
    </div>
  );
}

function MessageFileIcon({ mediaType, fileName }: { mediaType: string; fileName: string }) {
  if (mediaType.startsWith('image/')) return <ImageIcon className="h-4 w-4 shrink-0 text-purple-500" />;
  if (mediaType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return <FileText className="h-4 w-4 shrink-0 text-red-500" />;
  }
  if (mediaType.includes('spreadsheet') || fileName.endsWith('.csv') || fileName.endsWith('.xlsx')) {
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-500" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-blue-500" />;
}
