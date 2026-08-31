'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, History, X } from 'lucide-react';
import {
  createConversationAction,
  deleteConversationAction,
  getConversationAction,
  getPageHelpGuideAction,
  listChatAgentsAction,
  listConversationsAction,
  updateConversationAction,
} from '@/app/(app)/chat/actions';
import type { ChatMessage, CanvasArtifact } from '@/lib/ai/chat-types';
import type { Agent } from '@/lib/ai/types';
import { DEFAULT_AGENT } from '@/lib/ai/types';
import {
  contextToInitialMessages,
  type AIContextPayload,
} from '@/lib/ai/use-ai-context';
import { usePageContext } from '@/lib/ai/use-page-context';
import {
  buildPageHelpMessage,
  resolveHelpAgent,
  resolvePageAgent,
} from '@/lib/ai/use-page-agent';
import { cn } from '@/lib/utils';
import { CHAT_BESIDE_FORM_WIDTH_CLASS, CHAT_DRAWER_WIDTH_CLASS } from '@/components/forms/form-drawer-layout';
import { useEntityDrawer } from '@/components/layout/EntityDrawerHost';
import { ChatInterface } from './ChatInterface';
import { ChatHistoryPanel, type ConversationItem } from './ChatHistoryPanel';
import { ChatArtifactDrawer } from './ChatArtifactDrawer';

export interface ChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContext?: AIContextPayload;
  agentId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /**
   * When true, chat sizes to the leftover width beside an open form/canvas
   * drawer, skips the dimming overlay, and stays non-modal so the form remains usable.
   */
  besideCanvas?: boolean;
  /** Override panel width classes. Defaults depend on canvas / besideCanvas. */
  widthClassName?: string;
  /** Opened via header Help (?) — prefer help agent and auto-send page help. */
  helpMode?: boolean;
  /** Bumps when Help is clicked again so a new help turn starts. */
  helpSessionKey?: number;
}

function newConversationId(): string {
  return crypto.randomUUID();
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const textPart = firstUser?.parts.find((p) => p.type === 'text');
  if (textPart && textPart.type === 'text' && textPart.text) {
    return textPart.text.slice(0, 80);
  }
  return 'New conversation';
}

export function ChatDrawer({
  open,
  onOpenChange,
  initialContext,
  agentId,
  relatedEntityType,
  relatedEntityId,
  besideCanvas = false,
  widthClassName,
  helpMode = false,
  helpSessionKey = 0,
}: ChatDrawerProps) {
  const {
    openEntityDrawer,
    closeEntityDrawer,
    isOpen: formDrawerOpen,
    hasOpenFormDrawer,
  } = useEntityDrawer();
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [conversationId, setConversationId] = useState(newConversationId);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>();
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [canvasArtifact, setCanvasArtifact] = useState<CanvasArtifact | null>(null);

  const pageContext = usePageContext();

  const reactId = useId();
  const titleId = `chat-drawer-title-${reactId}`;
  const descriptionId = `chat-drawer-description-${reactId}`;

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const artifactDrawerOpen = !!canvasArtifact;
  const toolDrawerOpen = formDrawerOpen || artifactDrawerOpen || hasOpenFormDrawer;
  const besideForm = besideCanvas || toolDrawerOpen;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);

    if (besideForm) {
      return () => document.removeEventListener('keydown', handleKey);
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, besideForm, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setAgentsLoaded(false);
      return;
    }
    void listChatAgentsAction().then((list) => {
      setAgents(list);
      setAgentsLoaded(true);
    });
    void listConversationsAction().then((list) => {
      setConversations(
        list.map((c) => ({
          ...c,
          updatedAtMs: new Date(c.updatedAt).getTime(),
        })),
      );
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setInitialMessages(undefined);
      setLiveMessages([]);
      setHistoryOpen(false);
      setCanvasArtifact(null);
      return;
    }

    const id = newConversationId();
    setConversationId(id);
    setSessionKey((current) => current + 1);

    const context = initialContext
      ? {
          ...initialContext,
          entityIds: {
            ...initialContext.entityIds,
            ...(relatedEntityType && relatedEntityId
              ? { [relatedEntityType]: relatedEntityId }
              : {}),
          },
        }
      : undefined;

    setInitialMessages(context ? contextToInitialMessages(context) : []);
    setLiveMessages([]);

    void createConversationAction({
      id,
      agentId,
    });
  }, [open, initialContext, agentId, relatedEntityType, relatedEntityId, helpSessionKey]);

  useEffect(() => {
    if (!open || !helpMode || initialContext) return;
    const route = pageContext.pathname?.trim();
    if (!route) return;
    let cancelled = false;
    void getPageHelpGuideAction(route).then((guide) => {
      if (cancelled || !guide) return;
      setHistoryOpen(false);
      closeEntityDrawer();
      setCanvasArtifact({
        id: `guide_${guide.slug}`,
        title: guide.title,
        contentType: 'markdown',
        content: guide.content,
        version: 1,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    helpMode,
    helpSessionKey,
    initialContext,
    pageContext.pathname,
    closeEntityDrawer,
  ]);

  const chatAgents = useMemo(
    () => (agents.length > 0 ? agents : [DEFAULT_AGENT]),
    [agents],
  );

  const preferredAgentId = useMemo(() => {
    if (initialContext) return undefined;
    if (helpMode) {
      return resolveHelpAgent(chatAgents)?.id;
    }
    return resolvePageAgent(pageContext, chatAgents)?.id;
  }, [initialContext, helpMode, pageContext, chatAgents]);

  const helpAgentMissing = helpMode && agentsLoaded && !preferredAgentId;

  const autoSendMessage = useMemo(() => {
    if (!helpMode || !agentsLoaded || initialContext) return undefined;
    return buildPageHelpMessage(pageContext);
  }, [helpMode, agentsLoaded, initialContext, pageContext]);

  const handleMessagesChange = useCallback(async (messages: ChatMessage[]) => {
    if (messages.length === 0) return;
    setLiveMessages(messages);
    const id = conversationIdRef.current;
    const title = deriveTitle(messages);
    await updateConversationAction(id, { title, messages });
    setConversations((current) => {
      const existing = current.find((c) => c.id === id);
      const updated: ConversationItem = {
        id,
        title,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now(),
        pinnedAt: existing?.pinnedAt,
        relatedEntityType: existing?.relatedEntityType,
        relatedEntityId: existing?.relatedEntityId,
      };
      return [updated, ...current.filter((c) => c.id !== id)];
    });
  }, []);

  const handleNewConversation = useCallback(() => {
    const id = newConversationId();
    void createConversationAction({ id, agentId });
    setConversationId(id);
    setSessionKey((k) => k + 1);
    setInitialMessages([]);
    setLiveMessages([]);
    setHistoryOpen(false);
    setCanvasArtifact(null);
    closeEntityDrawer();
  }, [agentId, closeEntityDrawer]);

  const handleSelectConversation = useCallback(async (id: string) => {
    const detail = await getConversationAction(id);
    setConversationId(id);
    setSessionKey((k) => k + 1);
    const msgs = (detail?.messages as ChatMessage[] | undefined) ?? [];
    setInitialMessages(msgs);
    setLiveMessages(msgs);
    setHistoryOpen(false);
    setCanvasArtifact(null);
    closeEntityDrawer();
  }, [closeEntityDrawer]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversationAction(id);
      setConversations((current) => current.filter((c) => c.id !== id));
      if (conversationId === id) handleNewConversation();
    },
    [conversationId, handleNewConversation],
  );

  const handleBranch = useCallback(
    (sourceMessages: ChatMessage[], messageId: string) => {
      const idx = sourceMessages.findIndex((m) => m.id === messageId);
      if (idx < 0) {
        handleNewConversation();
        return;
      }
      const branched = sourceMessages.slice(0, idx + 1);
      const id = newConversationId();
      const title = `Branch: ${deriveTitle(branched)}`;
      void createConversationAction({ id, title });
      setConversations((prev) => [
        {
          id,
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedAtMs: Date.now(),
        },
        ...prev,
      ]);
      setConversationId(id);
      setSessionKey((k) => k + 1);
      setInitialMessages(branched);
      setLiveMessages(branched);
      setHistoryOpen(false);
      void updateConversationAction(id, { title, messages: branched });
    },
    [handleNewConversation],
  );

  const handleOpenCanvas = useCallback((artifact: CanvasArtifact) => {
    setHistoryOpen(false);
    closeEntityDrawer();
    setCanvasArtifact(artifact);
  }, [closeEntityDrawer]);

  const handleOpenCanvasComponent = useCallback(
    (event: { component: string; props: Record<string, unknown> }) => {
      setHistoryOpen(false);
      setCanvasArtifact(null);
      const mergedProps = { ...event.props };
      const propJobId =
        typeof mergedProps.jobId === 'string' ? mergedProps.jobId.trim() : '';
      if (!propJobId && pageContext.jobId) {
        mergedProps.jobId = pageContext.jobId;
      }
      // Normalize common id aliases for detail drawers opened from chat/MCP tools
      if (
        event.component === 'TaskDetailDrawer' &&
        !mergedProps.taskId &&
        typeof mergedProps.id === 'string'
      ) {
        mergedProps.taskId = mergedProps.id;
      }
      if (
        event.component === 'AppointmentFormDrawer' &&
        !mergedProps.appointmentId &&
        typeof mergedProps.id === 'string'
      ) {
        mergedProps.appointmentId = mergedProps.id;
      }
      if (event.component === 'AssessmentPrintDrawer' && !mergedProps.entityId) {
        if (typeof mergedProps.id === 'string' && mergedProps.id.trim()) {
          mergedProps.entityId = mergedProps.id;
        } else if (
          typeof mergedProps.assessmentId === 'string' &&
          mergedProps.assessmentId.trim()
        ) {
          mergedProps.entityId = mergedProps.assessmentId;
        } else if (pageContext.entityType === 'assessment' && pageContext.entityId) {
          mergedProps.entityId = pageContext.entityId;
        }
      }
      openEntityDrawer({ component: event.component, props: mergedProps });
    },
    [pageContext.jobId, pageContext.entityId, pageContext.entityType, openEntityDrawer],
  );

  const handleArtifactOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setCanvasArtifact(null);
  }, []);

  const title = initialContext ? 'AI Assist' : helpMode ? 'Help' : 'Chat';
  const description = initialContext?.scope
    ? initialContext.scope
    : helpAgentMissing
      ? 'Install the Help System capability pack to enable Help Assistant'
      : helpMode
        ? 'Guides and steps for the page you are on'
        : 'Ask questions and take actions across your workspace';

  const resolvedWidthClassName =
    widthClassName ??
    (besideForm ? CHAT_BESIDE_FORM_WIDTH_CLASS : CHAT_DRAWER_WIDTH_CLASS);

  const drawer = mounted
    ? createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="chat-drawer-root"
              className={cn(
                'fixed inset-0',
                besideForm ? 'pointer-events-none z-[60]' : 'z-50',
              )}
              initial="closed"
              animate="open"
              exit="closed"
              aria-hidden={!open}
            >
              {!besideForm && (
                <motion.div
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                  variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  onClick={() => onOpenChange(false)}
                />
              )}
              <motion.div
                role="dialog"
                aria-modal={!besideForm}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className={cn(
                  'absolute inset-y-0 left-0 flex h-full flex-col overflow-hidden border-r border-slate-200 bg-background shadow-2xl transition-[width] duration-300 ease-in-out',
                  besideForm && 'pointer-events-auto',
                  resolvedWidthClassName,
                )}
                variants={{ closed: { x: '-100%' }, open: { x: 0 } }}
                transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.9 }}
              >
                <div
                  data-slot="drawer-header"
                  className="flex items-start justify-between gap-4 border-b border-sidebar-border px-8 py-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <h2
                        id={titleId}
                        className="font-heading text-lg font-semibold leading-6 text-sidebar-foreground"
                      >
                        {title}
                      </h2>
                      <p
                        id={descriptionId}
                        className="mt-1 text-sm text-sidebar-foreground/65"
                      >
                        {description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!toolDrawerOpen && (
                      <button
                        type="button"
                        onClick={() => setHistoryOpen((v) => !v)}
                        aria-label={
                          historyOpen
                            ? 'Hide conversation history'
                            : 'Show conversation history'
                        }
                        aria-pressed={historyOpen}
                        className={cn(
                          'mt-0.5 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                          historyOpen && 'bg-sidebar-accent text-sidebar-foreground',
                        )}
                      >
                        <History className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      aria-label="Close"
                      className="mt-0.5 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div className="min-h-0 min-w-0 flex-1">
                    {(agentsLoaded || !helpMode) && (
                    <ChatInterface
                      key={`${conversationId}-${sessionKey}`}
                      conversationId={conversationId}
                      initialMessages={initialMessages}
                      agents={chatAgents}
                      pageContext={initialContext ? undefined : pageContext}
                      preferredAgentId={preferredAgentId}
                      forcePreferredAgent={helpMode && !helpAgentMissing}
                      autoSendMessage={helpAgentMissing ? undefined : autoSendMessage}
                      onMessagesChange={handleMessagesChange}
                      onOpenCanvas={handleOpenCanvas}
                      onOpenCanvasComponent={handleOpenCanvasComponent}
                      onBranch={handleBranch}
                      relatedRecordType={relatedEntityType}
                      relatedRecordId={relatedEntityId}
                    />
                    )}
                  </div>

                  <div
                    className={cn(
                      'flex flex-col overflow-hidden border-l border-slate-200 bg-white transition-all duration-300 ease-in-out',
                      historyOpen && !toolDrawerOpen
                        ? 'w-72 min-w-[18rem] opacity-100'
                        : 'w-0 min-w-0 border-l-0 opacity-0',
                    )}
                  >
                    {historyOpen && !toolDrawerOpen && (
                      <ChatHistoryPanel
                        conversations={conversations}
                        activeId={conversationId}
                        onSelect={(id) => void handleSelectConversation(id)}
                        onNew={handleNewConversation}
                        onDelete={(id) => void handleDeleteConversation(id)}
                        activeMessages={liveMessages}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <>
      {drawer}

      <ChatArtifactDrawer
        artifact={canvasArtifact}
        open={artifactDrawerOpen}
        onOpenChange={handleArtifactOpenChange}
        companionChatOpen={open}
      />
    </>
  );
}
