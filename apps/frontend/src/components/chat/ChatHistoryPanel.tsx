'use client';

import { useMemo, useState } from 'react';
import { Download, Link2, MessageSquare, Pin, PinOff, Plus, Search, Share2, Trash2, X } from 'lucide-react';
import type { ChatConversationSummary } from '@/types/api';
import type { ChatMessage } from '@/lib/ai/chat-types';
import { downloadConversationMarkdown } from '@/lib/ai/export-conversation-markdown';
import { getConversationAction } from '@/app/(app)/chat/actions';
import { cn } from '@/lib/utils';

export interface ConversationItem extends ChatConversationSummary {
  updatedAtMs: number;
}

interface ChatHistoryPanelProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onShare?: (id: string) => void;
  /** Optional in-memory messages for the active conversation (faster export). */
  activeMessages?: ChatMessage[];
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

async function exportConversation(
  conv: ConversationItem,
  activeId: string | null,
  activeMessages?: ChatMessage[],
): Promise<void> {
  try {
    let messages: ChatMessage[] = [];
    if (conv.id === activeId && activeMessages && activeMessages.length > 0) {
      messages = activeMessages;
    } else {
      const detail = await getConversationAction(conv.id);
      messages = (detail?.messages as ChatMessage[] | undefined) ?? [];
    }
    downloadConversationMarkdown(conv.title || 'Conversation', messages);
  } catch {
    /* ignore */
  }
}

export function ChatHistoryPanel({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onPin,
  onUnpin,
  onShare,
  activeMessages,
}: ChatHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title?.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const { pinned, unpinned } = useMemo(() => {
    const p = filteredConversations.filter((c) => c.pinnedAt);
    const u = filteredConversations.filter((c) => !c.pinnedAt);
    p.sort((a, b) => {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return bTime - aTime;
    });
    return { pinned: p, unpinned: u };
  }, [filteredConversations]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          History
        </h3>
        <button
          type="button"
          onClick={onNew}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="New conversation"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 pb-2 pt-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-8 text-xs focus:border-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-3 py-10 text-center">
            <MessageSquare className="mb-2 h-5 w-5 text-slate-300" />
            <p className="text-xs text-slate-400">No conversations yet</p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Pinned
                </p>
                <ul className="mb-3 space-y-1">
                  {pinned.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      activeId={activeId}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      onPin={onPin}
                      onUnpin={onUnpin}
                      onShare={onShare}
                      onExport={() => exportConversation(conv, activeId, activeMessages)}
                    />
                  ))}
                </ul>
                {unpinned.length > 0 && (
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Recent
                  </p>
                )}
              </>
            )}
            <ul className="space-y-1">
              {unpinned.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conv={conv}
                  activeId={activeId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onPin={onPin}
                  onUnpin={onUnpin}
                  onShare={onShare}
                  onExport={() => exportConversation(conv, activeId, activeMessages)}
                />
              ))}
            </ul>
          </>
        )}
        {filteredConversations.length === 0 && searchQuery.trim() && (
          <p className="px-3 py-4 text-center text-xs text-slate-400">No conversations found</p>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conv,
  activeId,
  onSelect,
  onDelete,
  onPin,
  onUnpin,
  onShare,
  onExport,
}: {
  conv: ConversationItem;
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onShare?: (id: string) => void;
  onExport: () => void;
}) {
  const isPinned = !!conv.pinnedAt;

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(conv.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(conv.id);
          }
        }}
        className={cn(
          'group flex w-full cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-left transition-colors',
          activeId === conv.id
            ? 'bg-primary/5 text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        )}
      >
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
            <p className="truncate text-xs font-medium">
              {conv.title || 'Untitled conversation'}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <p className="text-[10px] text-slate-400">
              {formatRelativeTime(conv.updatedAtMs)}
            </p>
            {conv.relatedEntityType && (
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-600">
                <Link2 className="h-2.5 w-2.5" />
                {conv.relatedEntityType}
              </span>
            )}
          </div>
        </div>
        <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExport();
            }}
            className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 group-hover:flex"
            title="Export conversation"
          >
            <Download className="h-3 w-3" />
          </button>
          {onShare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare(conv.id);
              }}
              className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-500 group-hover:flex"
              title="Share"
            >
              <Share2 className="h-3 w-3" />
            </button>
          )}
          {isPinned && onUnpin ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnpin(conv.id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-amber-500 hover:bg-amber-50"
              title="Unpin"
            >
              <PinOff className="h-3 w-3" />
            </button>
          ) : (
            onPin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPin(conv.id);
                }}
                className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-amber-50 hover:text-amber-500 group-hover:flex"
                title="Pin"
              >
                <Pin className="h-3 w-3" />
              </button>
            )
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conv.id);
            }}
            className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
            title="Delete conversation"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </li>
  );
}
