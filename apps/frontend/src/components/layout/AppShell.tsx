'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar, type AppSidebarUser } from './AppSidebar';

export interface AppShellProps {
  header: React.ReactNode;
  user?: AppSidebarUser | null;
  children: React.ReactNode;
}

export function AppShell({ header, user, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        {header}
        <div className="flex-1 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
