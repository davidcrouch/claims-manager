'use client';

import { useEffect, type ReactNode } from 'react';
import { useBreadcrumbsOptional } from './BreadcrumbProvider';

export interface SetHeaderStatusProps {
  children: ReactNode;
}

/**
 * Registers a status label in the app header, rendered under the user-icon
 * cluster while the page is mounted. Does not take part in header flex layout.
 */
export function SetHeaderStatus({ children }: SetHeaderStatusProps) {
  const ctx = useBreadcrumbsOptional();

  useEffect(() => {
    if (!ctx) {
      console.error(
        '[SetHeaderStatus] useBreadcrumbs must be used within BreadcrumbProvider',
      );
      return;
    }
    ctx.setHeaderStatus(children);
    return () => ctx.setHeaderStatus(null);
  }, [children, ctx]);

  return null;
}
