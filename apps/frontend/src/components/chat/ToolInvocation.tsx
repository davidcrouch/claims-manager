'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code,
  FileText,
  Loader2,
  PanelRight,
  Search,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasArtifact } from '@/lib/ai/chat-types';

interface ToolInvocationProps {
  toolName: string;
  args: unknown;
  state: 'pending' | 'complete' | 'error';
  result?: unknown;
  onOpenCanvas?: (artifact: CanvasArtifact) => void;
}

const CANVAS_TOOL_NAMES = new Set(['open_canvas', 'update_canvas']);
const SKILL_TOOL_NAMES = new Set(['activate_skill', 'search_skills']);

function stripMcpPrefix(name: string): string {
  const dunderIdx = name.indexOf('__');
  if (name.startsWith('mcp_') && dunderIdx !== -1) {
    return name.slice(dunderIdx + 2);
  }
  return name;
}

function formatToolDisplayName(name: string): string {
  return stripMcpPrefix(name)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isCanvasTool(toolName: string): boolean {
  const stripped = stripMcpPrefix(toolName);
  return CANVAS_TOOL_NAMES.has(toolName) || CANVAS_TOOL_NAMES.has(stripped);
}

function isSkillTool(toolName: string): boolean {
  const stripped = stripMcpPrefix(toolName);
  return SKILL_TOOL_NAMES.has(toolName) || SKILL_TOOL_NAMES.has(stripped);
}

function CanvasToolCard({
  toolName,
  args,
  state,
  result,
  onOpenCanvas,
}: ToolInvocationProps) {
  const isLoading = state === 'pending';
  const stripped = stripMcpPrefix(toolName);
  const isUpdate = stripped === 'update_canvas' || toolName === 'update_canvas';
  const argObj = (args ?? {}) as Record<string, unknown>;
  const res = result as Record<string, unknown> | undefined;
  const contentType = String(res?.contentType ?? argObj.contentType ?? 'markdown');
  const title = String(res?.title ?? argObj.title ?? 'Untitled');
  const language = (res?.language ?? argObj.language) as string | undefined;

  const handleClick = () => {
    if (isLoading || !onOpenCanvas) return;
    const content = String(argObj.content ?? res?.content ?? '');
    onOpenCanvas({
      id: String(res?.artifactId ?? argObj.artifactId ?? toolName),
      title,
      contentType,
      content,
      language: language || undefined,
      version: (res?.version as number) ?? 1,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="my-2 flex w-full items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-left transition-colors hover:bg-blue-100 disabled:cursor-default disabled:hover:bg-blue-50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : contentType === 'code' ? (
          <Code className="h-4 w-4 text-blue-600" />
        ) : (
          <FileText className="h-4 w-4 text-blue-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-800">
          {isLoading
            ? (isUpdate ? 'Updating canvas...' : 'Opening canvas...')
            : title}
        </p>
        <p className="text-xs text-blue-500">
          {isLoading
            ? (isUpdate ? 'Revising content' : 'Creating artifact')
            : `${contentType}${language ? ` · ${language}` : ''}${res?.version ? ` · v${res.version}` : ''}`}
        </p>
      </div>
      {!isLoading && (
        <PanelRight className="h-4 w-4 shrink-0 text-blue-400" />
      )}
    </button>
  );
}

function SkillToolCard({ toolName, args, state, result }: ToolInvocationProps) {
  const isLoading = state === 'pending';
  const stripped = stripMcpPrefix(toolName);
  const isSearch = stripped === 'search_skills' || toolName === 'search_skills';
  const argObj = (args ?? {}) as Record<string, unknown>;
  const res = result as Record<string, unknown> | undefined;
  const skillName = res?.skillName ?? argObj.skillId ?? 'Skill';
  const mode = res?.mode as string | undefined;

  return (
    <div className="my-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-100">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
          ) : isSearch ? (
            <Search className="h-3.5 w-3.5 text-purple-600" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-purple-800">
            {isLoading
              ? (isSearch ? 'Searching skills...' : `Activating ${String(skillName)}...`)
              : (isSearch ? 'Skill Search' : `Skill: ${String(skillName)}`)}
          </p>
          {!isLoading && mode && (
            <p className="text-xs text-purple-500">Mode: {mode}</p>
          )}
          {!isLoading && argObj.reason ? (
            <p className="text-xs text-purple-500">{String(argObj.reason)}</p>
          ) : null}
        </div>
        {!isLoading && res?.activated ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        ) : null}
      </div>
    </div>
  );
}

export function ToolInvocation({
  toolName,
  args,
  state,
  result,
  onOpenCanvas,
}: ToolInvocationProps) {
  const [expanded, setExpanded] = useState(false);

  if (isCanvasTool(toolName)) {
    return (
      <CanvasToolCard
        toolName={toolName}
        args={args}
        state={state}
        result={result}
        onOpenCanvas={onOpenCanvas}
      />
    );
  }

  if (isSkillTool(toolName)) {
    return (
      <SkillToolCard
        toolName={toolName}
        args={args}
        state={state}
        result={result}
      />
    );
  }

  const displayName = formatToolDisplayName(toolName);
  const isLoading = state === 'pending';
  const isComplete = state === 'complete';
  const hasError = state === 'error'
    || (isComplete
      && result != null
      && typeof result === 'object'
      && 'error' in (result as Record<string, unknown>));

  return (
    <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 text-xs">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {isComplete && !hasError && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {hasError && <XCircle className="h-4 w-4 text-red-500" />}
        </div>
        <Wrench className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1 truncate font-medium text-slate-700">{displayName}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
            state === 'complete' && !hasError && 'bg-emerald-100 text-emerald-700',
            hasError && 'bg-red-100 text-red-700',
            state === 'pending' && 'bg-amber-100 text-amber-700',
          )}
        >
          {state}
        </span>
        <span className={cn('transition-transform', expanded && 'rotate-90')}>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2">
          {args != null && Object.keys(args as object).length > 0 && (
            <div>
              <p className="mb-1 font-medium text-slate-500">Parameters</p>
              <pre className="max-h-32 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="mb-1 font-medium text-slate-500">Result</p>
              <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
