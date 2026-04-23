'use client';

import { BreadcrumbProvider } from './BreadcrumbProvider';
import { AppShell } from './AppShell';
import { AppHeader } from './AppHeader';
import type { AppSidebarUser } from './AppSidebar';

export interface AppLayoutClientProps {
  user?: AppSidebarUser | null;
  children: React.ReactNode;
}

export function AppLayoutClient({ user, children }: AppLayoutClientProps) {
  return (
    <BreadcrumbProvider>
      <AppShell header={<AppHeader />} user={user}>
        {children}
      </AppShell>
    </BreadcrumbProvider>
  );
}
