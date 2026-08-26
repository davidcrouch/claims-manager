'use client';

import { Settings } from 'lucide-react';
import {
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  BreadcrumbConsumer,
  HeaderActionsConsumer,
  HeaderStatusConsumer,
} from './BreadcrumbProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserAvatarMenu } from './UserAvatarMenu';
import type { AppSidebarUser } from './AppSidebar';

export interface AppHeaderProps {
  user?: AppSidebarUser | null;
  showAdminSettings?: boolean;
  onOpenAdminSettings?: () => void;
  adminSettingsActive?: boolean;
}

export function AppHeader({
  user,
  showAdminSettings = false,
  onOpenAdminSettings,
  adminSettingsActive = false,
}: AppHeaderProps) {
  return (
    <header
      data-slot="app-header"
      className="sticky top-0 z-20 flex min-h-20 items-stretch gap-4 border-b border-sidebar-border px-4 py-2 text-sidebar-foreground"
    >
      <HeaderStatusConsumer />
      <SidebarTrigger className="self-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
      <SidebarRail />
      <div className="flex min-w-0 flex-1 items-stretch gap-4">
        <BreadcrumbConsumer />
        <HeaderActionsConsumer />
        <div className="flex shrink-0 items-center gap-2 self-stretch">
          <UserAvatarMenu user={user} />
          {showAdminSettings && onOpenAdminSettings ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Settings"
              title="Settings"
              aria-pressed={adminSettingsActive}
              onClick={onOpenAdminSettings}
              className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings className="h-4 w-4" />
            </Button>
          ) : null}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
