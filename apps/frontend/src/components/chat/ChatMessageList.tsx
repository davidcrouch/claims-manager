'use client';

import { memo, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ChatMessage, CanvasArtifact } from '@/lib/ai/chat-types';
import { MessageRenderer, type AgentAvatarInfo } from './MessageRenderer';
import type { PageContext } from '@/lib/ai/use-page-context';

const DEFAULT_SUGGESTIONS = [
  'Show me open claims',
  'List tasks due this week',
  'Find recent jobs for a claim',
  'Summarise accounts receivable',
  'What vendors do we have?',
];

const ASSESSMENT_TAB_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  building: 'Building',
  habitability: 'Habitability',
  hazards: 'Hazards',
  damage: 'Damage & Cause',
  makeSafe: 'Make Safe',
  temporaryAccommodation: 'Temp Accommodation',
  specialists: 'Specialists',
  recommendation: 'Recommendation',
};

function getSuggestions(ctx?: PageContext, helpMode?: boolean): string[] {
  if (helpMode) {
    if (ctx?.entityType === 'role' || ctx?.entityType === 'user') {
      return [
        'How do I create a custom role?',
        'What does invoices.approve control?',
        'How do I assign roles to a user?',
      ];
    }
    if (ctx?.entityType === 'assessment' && ctx.entityId) {
      const tabLabel = ASSESSMENT_TAB_LABELS[ctx.activeTab ?? 'attendance'] ?? 'Attendance';
      return [
        `Explain the ${tabLabel} section`,
        'What should I fill in first?',
        'What evidence belongs in the journals?',
      ];
    }
    const page = ctx?.pageLabel?.trim() || 'this page';
    return [
      `What are the first steps on ${page}?`,
      'What permissions do I need here?',
      'Where do I find related settings?',
    ];
  }

  const helpSuggestion =
    ctx?.pageLabel
      ? `Help me with this page: ${ctx.pageLabel}`
      : 'Help me with this page';

  if (ctx?.entityType === 'assessment') {
    if (!ctx.entityId) {
      return [
        helpSuggestion,
        'Create a new assessment for this job',
        'What assessments exist for this job?',
        'Open a blank assessment form',
      ];
    }
    const tabLabel = ASSESSMENT_TAB_LABELS[ctx.activeTab ?? 'attendance'] ?? 'Attendance';
    return [
      helpSuggestion,
      `Help me fill the ${tabLabel} section`,
      'Complete all remaining tabs',
      'Review journals for evidence',
      'Print this assessment as a PDF',
    ];
  }

  if (ctx?.entityType === 'role' || ctx?.entityType === 'user') {
    return [
      helpSuggestion,
      'How do I create a custom role?',
      'What does invoices.approve control?',
      'How do I assign roles to a user?',
    ];
  }

  return [helpSuggestion, ...DEFAULT_SUGGESTIONS];
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isSubmitting: boolean;
  getAgentInfoForMessage: (messageId: string) => AgentAvatarInfo | undefined;
  activeAgentInfo?: AgentAvatarInfo;
  onOpenCanvas?: (artifact: CanvasArtifact) => void;
  onSuggestionClick: (text: string) => void;
  onFeedback?: (messageId: string, rating: 'positive' | 'negative') => void;
  feedbackMap?: Record<string, 'positive' | 'negative'>;
  onRegenerate?: (messageId: string) => void;
  onInspect?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
  interruptedMessageId?: string | null;
  conversationId?: string;
  pageContext?: PageContext;
  helpMode?: boolean;
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isStreaming,
  isSubmitting,
  getAgentInfoForMessage,
  activeAgentInfo,
  onOpenCanvas,
  onSuggestionClick,
  onFeedback,
  feedbackMap,
  onRegenerate,
  onInspect,
  onEdit,
  onBranch,
  interruptedMessageId,
  conversationId,
  pageContext,
  helpMode = false,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, isSubmitting]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <MessageSquare className="h-8 w-8 text-blue-500" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-slate-800">
          {helpMode ? 'Questions about this page?' : 'How can I help you?'}
        </h3>
        <p className="mb-8 max-w-md text-center text-sm text-slate-500">
          {helpMode
            ? 'The guide is open beside this chat. Ask anything you need clarified.'
            : 'Ask about claims, jobs, invoices, contacts, or anything in your workspace.'}
        </p>
        <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
          {getSuggestions(pageContext, helpMode).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick(suggestion)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8" role="log" aria-live="polite">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((message, index) => (
          <MessageRenderer
            key={message.id}
            message={message}
            allMessages={messages}
            agentInfo={
              message.role === 'assistant'
                ? getAgentInfoForMessage(message.id) ?? activeAgentInfo
                : undefined
            }
            isStreaming={
              isStreaming && index === messages.length - 1 && message.role === 'assistant'
            }
            isInterrupted={interruptedMessageId === message.id}
            conversationId={conversationId}
            onOpenCanvas={onOpenCanvas}
            onFeedback={message.role === 'assistant' ? onFeedback : undefined}
            existingRating={feedbackMap?.[message.id] ?? null}
            onRegenerate={onRegenerate}
            onInspect={onInspect}
            onEdit={onEdit}
            onBranch={onBranch}
          />
        ))}
        {isSubmitting && (
          <div className="text-xs text-slate-400">Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
});
