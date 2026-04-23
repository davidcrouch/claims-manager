'use client';

import { Bell } from 'lucide-react';
import {
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { BreadcrumbConsumer } from './BreadcrumbProvider';
import { Button } from '@/components/ui/button';

export function AppHeader() {
  return (
    <header className="flex min-h-14 items-center gap-4 border-b bg-background px-4 py-2">
      <SidebarTrigger />
      <SidebarRail />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <BreadcrumbConsumer />
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
