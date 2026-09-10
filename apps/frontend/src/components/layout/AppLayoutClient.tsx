'use client';

import { BreadcrumbProvider } from './BreadcrumbProvider';
import { CurrentJobProvider } from './CurrentJobProvider';
import { AppShell } from './AppShell';
import { ApiConnectionMonitor } from './ApiConnectionMonitor';
import { PermissionsProvider } from '@/components/providers/PermissionsProvider';
import type { AppSidebarUser } from './AppSidebar';

export interface AppLayoutClientProps {
  user?: AppSidebarUser | null;
  features?: string[];
  permissions?: string[];
  orgName?: string | null;
  children: React.ReactNode;
}

export function AppLayoutClient({
  user,
  features,
  permissions,
  orgName,
  children,
}: AppLayoutClientProps) {
  return (
    <BreadcrumbProvider>
      <CurrentJobProvider>
        <ApiConnectionMonitor />
        <PermissionsProvider permissions={permissions}>
          <AppShell
            user={user}
            features={features}
            permissions={permissions}
            orgName={orgName}
          >
            {children}
          </AppShell>
        </PermissionsProvider>
      </CurrentJobProvider>
    </BreadcrumbProvider>
  );
}
