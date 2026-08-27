'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { canUpdateCatalogFromEstimate, hasPermission } from '@/lib/permissions';

const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions?: string[];
  children: ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={permissions ?? []}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): string[] {
  return useContext(PermissionsContext);
}

export function useHasPermission(required: string): boolean {
  return hasPermission(usePermissions(), required);
}

export function useCanUpdateCatalogFromEstimate(): boolean {
  return canUpdateCatalogFromEstimate(usePermissions());
}
