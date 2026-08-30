export interface PageContext {
  pathname: string;
  section?: 'admin' | 'app';
  entityType?: string;
  entityId?: string;
  jobId?: string;
  pageLabel?: string;
  adminArea?: string;
  parentEntityId?: string;
  activeTab?: string;
}

export interface StreamChatDto {
  conversationId?: string;
  agentId?: string;
  messageId?: string;
  messages: unknown[];
  pageContext?: PageContext;
}

export interface StreamChatParams {
  user: import('../../auth/interfaces/authenticated-user.interface').AuthenticatedUser;
  bearerToken: string;
  dto: StreamChatDto;
}

export interface ChatMessagePart {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  state?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: string;
  parts: ChatMessagePart[];
  content?: string;
}

export interface UpsertAiSettingsDto {
  defaultProvider?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  maxTokensPerResponse?: number;
  enabled?: boolean;
}
