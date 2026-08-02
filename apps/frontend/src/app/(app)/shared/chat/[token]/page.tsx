import { createApiClient } from '@/lib/api-client';
import { MessageRenderer } from '@/components/chat/MessageRenderer';

interface SharedChatPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedChatPage({ params }: SharedChatPageProps) {
  const { token } = await params;

  const api = createApiClient({});
  let conversation: { title?: string | null; messages?: unknown[] } | null = null;

  try {
    conversation = await api.getSharedConversation(token) as any;
  } catch {
    conversation = null;
  }

  if (!conversation || ('error' in (conversation as any))) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-800">Link Expired or Invalid</h1>
          <p className="mt-2 text-sm text-slate-500">
            This shared chat link is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const messages = (conversation.messages ?? []) as Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
    createdAt?: string;
  }>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-lg font-semibold text-slate-800">
          {conversation.title ?? 'Shared Chat'}
        </h1>
        <p className="text-xs text-slate-500">Read-only shared view</p>
      </div>

      <div className="space-y-4">
        {messages.map((msg) => (
          <MessageRenderer
            key={msg.id}
            message={{
              id: msg.id,
              role: msg.role,
              parts: msg.parts as any,
              createdAt: msg.createdAt ?? new Date().toISOString(),
            }}
          />
        ))}
      </div>
    </div>
  );
}
