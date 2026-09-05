'use client';

import { createContext, useContext } from 'react';
import type { ChatDisplayMode } from '@/lib/ai/chat-display-mode';

const ChatDisplayModeContext = createContext<ChatDisplayMode>('normal');

export function ChatDisplayModeProvider({
  mode,
  children,
}: {
  mode: ChatDisplayMode;
  children: React.ReactNode;
}) {
  return (
    <ChatDisplayModeContext.Provider value={mode}>
      {children}
    </ChatDisplayModeContext.Provider>
  );
}

export function useChatDisplayMode(): ChatDisplayMode {
  return useContext(ChatDisplayModeContext);
}
