'use client';

import { useCallback, createContext, useContext, type ReactNode } from 'react';
import { canUpdateCatalogFromEstimate, hasPermission } from '@/lib/permissions';
import { notifyPermissionDenied } from '@/lib/permission-feedback';

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

/**
 * Returns a guard that shows the permission-denied dialog when the caller
 * does not hold `required`. Use before performing a UI action.
 */
export function useRequirePermission(
  required: string,
  action?: string,
): () => boolean {
  const allowed = useHasPermission(required);
  return useCallback(() => {
    if (allowed) return true;
    notifyPermissionDenied(action ? { action } : undefined);
    return false;
  }, [allowed, action]);
}

export function useCanUpdateCatalogFromEstimate(): boolean {
  return canUpdateCatalogFromEstimate(usePermissions());
}
