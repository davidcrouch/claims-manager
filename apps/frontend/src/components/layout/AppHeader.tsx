'use client';

import {
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { BreadcrumbConsumer } from './BreadcrumbProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function AppHeader() {
  return (
    <header
      data-slot="app-header"
      className="sticky top-0 z-20 flex min-h-14 items-center gap-4 border-b bg-background px-4 py-2"
    >
      <SidebarTrigger />
      <SidebarRail />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <BreadcrumbConsumer />
        <div className="flex shrink-0 items-center gap-2 pl-5">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
