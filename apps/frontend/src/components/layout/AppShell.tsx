'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { EntityDrawerProvider } from '@/components/layout/EntityDrawerHost';
import { hasFeature } from '@/lib/features';
import { AppHeader } from './AppHeader';
import {
  AppSidebar,
  hasAdminNavAccess,
  isAdminNavPath,
  type AppSidebarUser,
} from './AppSidebar';

export interface AppShellProps {
  user?: AppSidebarUser | null;
  features?: string[];
  permissions?: string[];
  orgName?: string | null;
  children: React.ReactNode;
}

export function AppShell({
  user,
  features,
  permissions,
  orgName,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOverride, setMenuOverride] = useState<'main' | 'admin' | null>(null);
  const chatEnabled = hasFeature(features, 'ai.chat');
  const showAdminSettings = hasAdminNavAccess(features, permissions);
  const adminSettingsActive =
    menuOverride === 'admin' ||
    (menuOverride !== 'main' && isAdminNavPath(pathname));

  const handleMenuOverrideChange = useCallback(
    (view: 'main' | 'admin' | null) => {
      setMenuOverride(view);
    },
    [],
  );

  return (
    <EntityDrawerProvider companionChatOpen={chatOpen}>
      <SidebarProvider>
        <AppSidebar
          features={features}
          permissions={permissions}
          orgName={orgName}
          onOpenChat={chatEnabled ? () => setChatOpen(true) : undefined}
          menuOverride={menuOverride}
          onMenuOverrideChange={handleMenuOverrideChange}
        />
        <SidebarInset>
          <AppHeader
            user={user}
            showAdminSettings={showAdminSettings}
            onOpenAdminSettings={() => setMenuOverride('admin')}
            adminSettingsActive={adminSettingsActive}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
        </SidebarInset>
        {chatEnabled && (
          <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
        )}
      </SidebarProvider>
    </EntityDrawerProvider>
  );
}
