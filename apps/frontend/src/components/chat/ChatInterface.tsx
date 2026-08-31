'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useChatStream } from '@/lib/ai/use-chat-stream';
import type { ChatMessage, CanvasArtifact, FilePart } from '@/lib/ai/chat-types';
import type { Agent } from '@/lib/ai/types';
import { DEFAULT_AGENT_ID } from '@/lib/ai/types';
import { agentSupportsVision, isImageFilePart } from '@/lib/ai/vision-capability';
import { ChatMessageList } from './ChatMessageList';
import { ChatInputBar, type ChatInputHandle } from './ChatInputBar';
import { MessageAuditDrawer } from './MessageAuditDrawer';
import { useAuditInspector } from './hooks/use-audit-inspector';
import { useFileUpload } from './hooks/useFileUpload';
import { useSpeechRecognition } from './use-speech-recognition';
import type { PageContext } from '@/lib/ai/use-page-context';
import type { AgentAvatarInfo } from './MessageRenderer';

interface ChatInterfaceProps {
  conversationId?: string;
  initialMessages?: ChatMessage[];
  agents: Agent[];
  pageContext?: PageContext;
  preferredAgentId?: string;
  /**
   * When true, keep applying preferredAgentId until the user manually picks an agent.
   * Used by Help (?) so page agents (e.g. Catalogue Assistant) cannot win a load race.
   */
  forcePreferredAgent?: boolean;
  /** When set, send this message once after the agent is selected and chat is ready. */
  autoSendMessage?: string;
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onOpenCanvas?: (artifact: CanvasArtifact) => void;
  onOpenCanvasComponent?: (event: {
    component: string;
    props: Record<string, unknown>;
  }) => void;
  onFeedback?: (messageId: string, rating: 'positive' | 'negative') => void;
  feedbackMap?: Record<string, 'positive' | 'negative'>;
  onBranch?: (messages: ChatMessage[], messageId: string) => void;
  relatedRecordType?: string;
  relatedRecordId?: string;
  startWithMic?: boolean;
}

export function ChatInterface({
  conversationId,
  initialMessages,
  agents,
  pageContext,
  preferredAgentId,
  forcePreferredAgent = false,
  autoSendMessage,
  onMessagesChange,
  onOpenCanvas,
  onOpenCanvasComponent,
  onFeedback,
  feedbackMap,
  onBranch,
  relatedRecordType,
  relatedRecordId,
  startWithMic,
}: ChatInterfaceProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [interruptedMessageId, setInterruptedMessageId] = useState<string | null>(null);
  const [pendingAttachmentParts, setPendingAttachmentParts] = useState<FilePart[]>([]);
  const [visionError, setVisionError] = useState<string | null>(null);
  const selectedAgentIdRef = useRef<string | null>(null);
  const userPickedAgentRef = useRef(false);
  const inputBarRef = useRef<ChatInputHandle>(null);
  const prevStatusRef = useRef<string>('ready');
  const stoppedRef = useRef(false);
  const didAutoStartMicRef = useRef(false);
  const didAutoSendRef = useRef(false);
  const audit = useAuditInspector();
  const fileUpload = useFileUpload(conversationId);

  const handleSpeechTranscript = useCallback((text: string) => {
    inputBarRef.current?.appendDraft(text);
  }, []);

  const {
    isListening,
    isSupported: isSpeechSupported,
    interimTranscript,
    error: speechError,
    toggle: toggleSpeech,
  } = useSpeechRecognition({ onTranscript: handleSpeechTranscript });

  useEffect(() => {
    if (!startWithMic || !isSpeechSupported || didAutoStartMicRef.current) return;
    didAutoStartMicRef.current = true;
    toggleSpeech();
  }, [startWithMic, isSpeechSupported, toggleSpeech]);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    // Prefer real agents over the client-side DEFAULT_AGENT sentinel (id: "default").
    const realAgents = agents.filter((a) => a.id !== DEFAULT_AGENT_ID);
    const pool = realAgents.length > 0 ? realAgents : agents;

    if (!userPickedAgentRef.current && preferredAgentId) {
      const preferred = pool.find((a) => a.id === preferredAgentId);
      if (preferred) {
        // Help mode: always apply preferred (overrides page-agent races).
        // Normal chat: only apply when nothing valid is selected yet.
        const selectionValid =
          !!selectedAgentId && pool.some((a) => a.id === selectedAgentId);
        if (forcePreferredAgent || !selectionValid) {
          if (selectedAgentId !== preferred.id) {
            setSelectedAgentId(preferred.id);
            selectedAgentIdRef.current = preferred.id;
          }
          return;
        }
      } else if (forcePreferredAgent) {
        // Preferred help agent not in pool yet — wait rather than falling back.
        return;
      }
    }

    const selectionValid =
      !!selectedAgentId && pool.some((a) => a.id === selectedAgentId);
    if (selectionValid) return;

    const defaultAgent = pool.find((a) => a.isDefault) ?? pool[0];
    if (!defaultAgent) return;

    setSelectedAgentId(defaultAgent.id);
    selectedAgentIdRef.current = defaultAgent.id;
  }, [agents, selectedAgentId, preferredAgentId, forcePreferredAgent]);

  const handleCanvasAction = useCallback(
    (artifact: CanvasArtifact) => {
      onOpenCanvas?.(artifact);
    },
    [onOpenCanvas],
  );

  const handleCanvasComponent = useCallback(
    (event: { component: string; props: Record<string, unknown> }) => {
      onOpenCanvasComponent?.(event);
    },
    [onOpenCanvasComponent],
  );

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
  } = useChatStream({
    api: '/api/chat',
    initialMessages,
    body: () => ({
      agentId:
        selectedAgentIdRef.current &&
        selectedAgentIdRef.current !== DEFAULT_AGENT_ID
          ? selectedAgentIdRef.current
          : undefined,
      conversationId,
      pageContext: pageContext ?? undefined,
    }),
    onCanvasAction: handleCanvasAction,
    onCanvasComponent: handleCanvasComponent,
  });

  const isStreaming = status === 'streaming';
  const isSubmitting = status === 'submitted';
  const isLoading = isStreaming || isSubmitting;

  useEffect(() => {
    if (messages.length > 0) {
      onMessagesChange?.(messages);
    }
  }, [messages, status, onMessagesChange]);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prevStatus === 'streaming' && status === 'error') {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        setInterruptedMessageId(lastAssistant.id);
      }
    }

    if (prevStatus === 'streaming' && status === 'ready' && stoppedRef.current) {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant) {
        setInterruptedMessageId(lastAssistant.id);
      }
      stoppedRef.current = false;
    }

    if (status === 'submitted' || status === 'streaming') {
      setInterruptedMessageId(null);
    }
  }, [status, messages]);

  useEffect(() => {
    if (!conversationId) return;
    if (status !== 'ready' && status !== 'error') return;
    if (!messages.some((m) => m.role === 'assistant')) return;
    void audit.fetchAuditRecords(conversationId);
    // Fetch when a turn settles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, conversationId]);

  const handleSelectAgent = useCallback((agentId: string) => {
    userPickedAgentRef.current = true;
    setSelectedAgentId(agentId);
    selectedAgentIdRef.current = agentId;
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const supportsVision = selectedAgent ? agentSupportsVision(selectedAgent) : true;
  const selectedAgentAvatar: AgentAvatarInfo | undefined = useMemo(
    () =>
      selectedAgent
        ? { name: selectedAgent.name, avatarColor: selectedAgent.avatarColor }
        : undefined,
    [selectedAgent],
  );

  const messageAgentSnapshotRef = useRef(new Map<string, AgentAvatarInfo>());
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant' && !messageAgentSnapshotRef.current.has(msg.id) && selectedAgentAvatar) {
        messageAgentSnapshotRef.current.set(msg.id, selectedAgentAvatar);
      }
    }
  }, [messages, selectedAgentAvatar]);

  const getAgentInfoForMessage = useCallback(
    (messageId: string) => {
      const fromAudit = audit.auditRecords.find((r) => r.messageId === messageId);
      if (fromAudit?.agentName) {
        return {
          name: fromAudit.agentName,
          avatarColor: fromAudit.agentAvatarColor ?? undefined,
        };
      }
      return messageAgentSnapshotRef.current.get(messageId);
    },
    [audit.auditRecords],
  );

  const handleStop = useCallback(() => {
    if (isStreaming) {
      stoppedRef.current = true;
    }
    stop();
  }, [isStreaming, stop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        handleStop();
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          const text = lastAssistant.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('\n\n');
          void navigator.clipboard.writeText(text);
        }
      }

      const activeTag = document.activeElement?.tagName;
      if (
        e.key === '/'
        && !isLoading
        && activeTag !== 'TEXTAREA'
        && activeTag !== 'INPUT'
        && !(document.activeElement as HTMLElement | null)?.isContentEditable
      ) {
        e.preventDefault();
        inputBarRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, isLoading, messages, handleStop]);

  const submitMessage = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? '').trim();
    if (
      (!trimmed && fileUpload.selectedFiles.length === 0 && pendingAttachmentParts.length === 0)
      || isLoading
      || fileUpload.isProcessingFiles
    ) {
      return;
    }

    const text = trimmed || 'Please analyze the attached file(s).';
    let fileParts: FilePart[] = [...pendingAttachmentParts];

    if (fileUpload.selectedFiles.length > 0) {
      const { parts, hadErrors } = await fileUpload.processFiles();
      fileParts = [...fileParts, ...parts];
      if (parts.length === 0 && hadErrors) {
        return;
      }
    }

    if (!supportsVision && fileParts.some(isImageFilePart)) {
      setVisionError('This agent does not support image attachments. Choose a vision-capable agent or remove images.');
      return;
    }

    setVisionError(null);
    sendMessage({
      text,
      files: fileParts.length > 0 ? fileParts : undefined,
    });

    setPendingAttachmentParts([]);
    inputBarRef.current?.clearDraft();
  }, [
    isLoading,
    fileUpload.selectedFiles,
    fileUpload.isProcessingFiles,
    fileUpload.processFiles,
    sendMessage,
    pendingAttachmentParts,
    supportsVision,
  ]);

  useEffect(() => {
    if (!autoSendMessage?.trim() || didAutoSendRef.current) return;
    if (!selectedAgentId) return;
    if (isLoading) return;
    if ((initialMessages?.length ?? 0) > 0 || messages.length > 0) return;

    didAutoSendRef.current = true;
    void submitMessage(autoSendMessage);
  }, [
    autoSendMessage,
    selectedAgentId,
    isLoading,
    initialMessages,
    messages.length,
    submitMessage,
  ]);

  const handleAttachDocument = useCallback(
    (part: FilePart) => {
      if (!supportsVision && isImageFilePart(part)) {
        setVisionError('This agent does not support image attachments.');
        return;
      }
      setPendingAttachmentParts((prev) => [...prev, part]);
    },
    [supportsVision],
  );

  const handleAddFiles = useCallback(
    (files: File[]) => {
      if (!supportsVision && files.some((f) => f.type.startsWith('image/'))) {
        setVisionError('This agent does not support image attachments.');
        return;
      }
      fileUpload.addFiles(files);
    },
    [supportsVision, fileUpload.addFiles],
  );

  const handleRemovePendingAttachment = useCallback((index: number) => {
    setPendingAttachmentParts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearVisionError = useCallback(() => {
    setVisionError(null);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    inputBarRef.current?.setDraft(suggestion);
    setTimeout(() => inputBarRef.current?.focus(), 0);
  }, []);

  const handleRegenerate = useCallback((assistantMessageId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === assistantMessageId);
    if (msgIndex < 0) return;

    let userMsg: ChatMessage | undefined;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    const textPart = userMsg.parts.find((p) => p.type === 'text');
    const text = textPart && 'text' in textPart ? textPart.text : '';
    if (!text && !userMsg.parts.some((p) => p.type === 'file')) return;

    const fileParts = userMsg.parts.filter((p): p is FilePart => p.type === 'file');
    sendMessage({
      text: text || 'Please analyze the attached file(s).',
      files: fileParts.length > 0 ? fileParts : undefined,
    });
  }, [messages, sendMessage]);

  const handleInspect = useCallback(async (messageId: string) => {
    await audit.inspectMessage(messageId, conversationId, messages);
  }, [audit, conversationId, messages]);

  const handleEdit = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const textContent = msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n\n');

    const fileParts = msg.parts.filter((p): p is FilePart => p.type === 'file');
    setPendingAttachmentParts(fileParts);
    inputBarRef.current?.setDraft(textContent);
    inputBarRef.current?.focus();
  }, [messages]);

  const handleBranch = useCallback((messageId: string) => {
    onBranch?.(messages, messageId);
  }, [messages, onBranch]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatMessageList
        messages={messages}
        isStreaming={isStreaming}
        isSubmitting={isSubmitting}
        getAgentInfoForMessage={getAgentInfoForMessage}
        activeAgentInfo={selectedAgentAvatar}
        onOpenCanvas={onOpenCanvas}
        onSuggestionClick={handleSuggestionClick}
        onFeedback={onFeedback}
        feedbackMap={feedbackMap}
        onRegenerate={handleRegenerate}
        onInspect={handleInspect}
        onEdit={handleEdit}
        onBranch={onBranch ? handleBranch : undefined}
        interruptedMessageId={interruptedMessageId}
        conversationId={conversationId}
        pageContext={pageContext}
      />

      {error && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{error.message}</p>
        </div>
      )}

      <ChatInputBar
        ref={inputBarRef}
        onSubmit={submitMessage}
        onStop={handleStop}
        isLoading={isLoading}
        isProcessingFiles={fileUpload.isProcessingFiles}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={handleSelectAgent}
        selectedFiles={fileUpload.selectedFiles}
        fileErrors={fileUpload.fileErrors}
        fileInputRef={fileUpload.fileInputRef}
        onFilesSelected={fileUpload.handleFilesSelected}
        onRemoveFile={fileUpload.removeFile}
        onAddFiles={handleAddFiles}
        pendingAttachmentParts={pendingAttachmentParts}
        onRemovePendingAttachment={handleRemovePendingAttachment}
        relatedRecordType={relatedRecordType}
        relatedRecordId={relatedRecordId}
        supportsVision={supportsVision}
        visionError={visionError}
        onClearVisionError={handleClearVisionError}
        onVisionBlocked={setVisionError}
        onAttachDocument={handleAttachDocument}
        isSpeechSupported={isSpeechSupported}
        isListening={isListening}
        interimTranscript={interimTranscript}
        onToggleSpeech={toggleSpeech}
        speechError={speechError}
      />

      <MessageAuditDrawer
        open={audit.auditDrawerOpen}
        onOpenChange={audit.setAuditDrawerOpen}
        audit={audit.selectedAudit}
        reasoning={audit.selectedReasoning}
        toolCalls={audit.selectedToolCalls}
      />
    </div>
  );
}
