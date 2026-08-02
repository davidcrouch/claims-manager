'use client';

import { BreadcrumbProvider } from './BreadcrumbProvider';
import { AppShell } from './AppShell';
import { AppHeader } from './AppHeader';
import type { AppSidebarUser } from './AppSidebar';

export interface AppLayoutClientProps {
  user?: AppSidebarUser | null;
  features?: string[];
  orgName?: string | null;
  children: React.ReactNode;
}

export function AppLayoutClient({ user, features, orgName, children }: AppLayoutClientProps) {
  return (
    <BreadcrumbProvider>
      <AppShell header={<AppHeader user={user} />} features={features} orgName={orgName}>
        {children}
      </AppShell>
    </BreadcrumbProvider>
  );
}
