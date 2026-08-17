'use client';

import { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { EntityDrawerProvider } from '@/components/layout/EntityDrawerHost';
import { hasFeature } from '@/lib/features';
import { AppSidebar } from './AppSidebar';

export interface AppShellProps {
  header: React.ReactNode;
  features?: string[];
  permissions?: string[];
  orgName?: string | null;
  children: React.ReactNode;
}

export function AppShell({ header, features, permissions, orgName, children }: AppShellProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const chatEnabled = hasFeature(features, 'ai.chat');

  return (
    <EntityDrawerProvider companionChatOpen={chatOpen}>
      <SidebarProvider>
        <AppSidebar
          features={features}
          permissions={permissions}
          orgName={orgName}
          onOpenChat={chatEnabled ? () => setChatOpen(true) : undefined}
        />
        <SidebarInset>
          {header}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
        </SidebarInset>
        {chatEnabled && (
          <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
        )}
      </SidebarProvider>
    </EntityDrawerProvider>
  );
}
