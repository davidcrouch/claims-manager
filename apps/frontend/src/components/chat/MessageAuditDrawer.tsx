'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Cpu,
  Paperclip,
  Wrench,
} from 'lucide-react';
import { BottomFormDrawer } from '@/components/forms/BottomFormDrawer';
import { cn } from '@/lib/utils';
import type { AiAuditRecord, AttachmentMeta } from '@/lib/ai/types';
import type { ToolCallDetail } from './hooks/use-audit-inspector';

interface MessageAuditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audit: AiAuditRecord | null;
  reasoning?: string;
  toolCalls?: ToolCallDetail[];
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function MessageAuditDrawer({
  open,
  onOpenChange,
  audit,
  reasoning,
  toolCalls,
}: MessageAuditDrawerProps) {
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedToolIdx, setExpandedToolIdx] = useState<number | null>(null);

  const copySystemPrompt = async () => {
    if (!audit?.systemPrompt) return;
    await navigator.clipboard.writeText(audit.systemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isError = audit?.status === 'error';
  const detailedTools = toolCalls && toolCalls.length > 0 ? toolCalls : null;
  const fallbackTools = audit?.toolsInvoked ?? [];

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Message Audit"
      icon={<Cpu className="h-5 w-5 text-violet-500" />}
      widthClassName="w-[520px]"
    >
      <div className="space-y-5 overflow-y-auto p-4">
        {!audit ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No audit data for this message</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              This message was sent before audit tracking was enabled, or the conversation ID was not linked.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  background: audit.agentAvatarColor
                    ?? 'linear-gradient(to bottom right, #3b82f6, #4f46e5)',
                }}
              >
                {(audit.agentName ?? 'AI').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {isError ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <p className="truncate text-sm font-medium text-slate-800">
                    {audit.agentName ?? audit.agentId ?? 'Agent'}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(audit.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Model & Settings
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoCell label="Provider" value={audit.provider} />
                <InfoCell label="Model" value={audit.model} />
                <InfoCell
                  label="Temperature"
                  value={audit.temperature != null ? String(audit.temperature) : '—'}
                />
                <InfoCell
                  label="Max Tokens"
                  value={audit.maxTokens != null ? String(audit.maxTokens) : '—'}
                />
              </div>
            </section>

            {audit.systemPrompt && (
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    System Prompt
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={copySystemPrompt}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Copy"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSystemExpanded(!systemExpanded)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      {systemExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div
                  className={cn(
                    'overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700',
                    systemExpanded ? 'max-h-[40vh]' : 'max-h-24',
                  )}
                >
                  <pre className="whitespace-pre-wrap font-mono">
                    {audit.systemPrompt}
                  </pre>
                </div>
              </section>
            )}

            {reasoning && (
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-500">
                    Reasoning
                  </h3>
                  <button
                    type="button"
                    onClick={() => setReasoningExpanded(!reasoningExpanded)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    {reasoningExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                <div
                  className={cn(
                    'overflow-y-auto rounded-md border border-purple-200 bg-purple-50 p-2 text-xs text-purple-800',
                    reasoningExpanded ? 'max-h-[40vh]' : 'max-h-24',
                  )}
                >
                  <pre className="whitespace-pre-wrap">{reasoning}</pre>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Token Usage
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <InfoCell label="Input" value={String(audit.inputTokens)} />
                <InfoCell label="Output" value={String(audit.outputTokens)} />
                <InfoCell
                  label="Total"
                  value={String(audit.totalTokens)}
                  highlight
                />
              </div>
            </section>

            {(detailedTools || fallbackTools.length > 0) && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tools Invoked ({detailedTools?.length ?? fallbackTools.length})
                </h3>
                {detailedTools ? (
                  <div className="space-y-1.5">
                    {detailedTools.map((tc, i) => {
                      const isExpanded = expandedToolIdx === i;
                      return (
                        <div key={i} className="rounded-md border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setExpandedToolIdx(isExpanded ? null : i)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100"
                          >
                            <CheckCircle2
                              className={cn(
                                'h-3.5 w-3.5 shrink-0',
                                tc.state === 'complete' ? 'text-green-500' : 'text-slate-400',
                              )}
                            />
                            <span className="flex-1 truncate text-xs font-medium text-slate-700">
                              {tc.displayName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="space-y-2 border-t border-slate-200 px-3 py-2">
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Input
                                </p>
                                <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-xs text-slate-600">
                                  {JSON.stringify(tc.args, null, 2)}
                                </pre>
                              </div>
                              {tc.result !== undefined && (
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Output
                                  </p>
                                  <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs text-slate-600">
                                    {typeof tc.result === 'string'
                                      ? tc.result
                                      : JSON.stringify(tc.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {fallbackTools.map((tool, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs"
                      >
                        <Wrench className="h-3 w-3 text-slate-400" />
                        <span className="font-mono text-slate-700">{tool.name}</span>
                        {tool.argsKeys.length > 0 && (
                          <span className="text-slate-400">
                            ({tool.argsKeys.join(', ')})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {audit.attachmentsMetadata && audit.attachmentsMetadata.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attachments ({audit.attachmentsMetadata.length})
                </h3>
                <div className="space-y-2">
                  {audit.attachmentsMetadata.map((attachment, i) => (
                    <AttachmentRow key={`${attachment.filename}-${i}`} attachment={attachment} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Request Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] text-slate-500">Duration</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDuration(audit.requestDurationMs)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      audit.status === 'success' ? 'bg-green-500' : 'bg-red-500',
                    )}
                  />
                  <div>
                    <p className="text-[10px] text-slate-500">Status</p>
                    <p className="text-sm font-medium capitalize text-slate-800">
                      {audit.status}
                    </p>
                  </div>
                </div>
              </div>
              {audit.errorMessage && (
                <div className="mt-2 rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700">
                  {audit.errorMessage}
                </div>
              )}
            </section>

            {audit.enabledTools && audit.enabledTools.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Enabled Tools ({audit.enabledTools.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {audit.enabledTools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </BottomFormDrawer>
  );
}

function AttachmentRow({ attachment }: { attachment: AttachmentMeta }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-slate-700">{attachment.filename}</p>
        <span className="shrink-0 text-[10px] text-slate-400">{attachment.mimeType}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span>{(attachment.sizeBytes / 1024).toFixed(1)} KB</span>
        {attachment.hydrationMs != null && <span>Hydration {attachment.hydrationMs}ms</span>}
        {attachment.hydrationFallback && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
            {attachment.hydrationFallback}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p
        className={cn(
          'truncate text-sm font-medium',
          highlight ? 'text-blue-700' : 'text-slate-800',
        )}
      >
        {value}
      </p>
    </div>
  );
}
