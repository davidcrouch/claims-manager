'use client';

import { useEffect, type ReactNode } from 'react';
import { useBreadcrumbsOptional } from './BreadcrumbProvider';

export interface SetHeaderActionsProps {
  children: ReactNode;
}

/**
 * Registers action controls (e.g. Save) in the app header, rendered to the
 * left of the user avatar while the page is mounted.
 */
export function SetHeaderActions({ children }: SetHeaderActionsProps) {
  const ctx = useBreadcrumbsOptional();

  useEffect(() => {
    if (!ctx) {
      console.error(
        '[SetHeaderActions] useBreadcrumbs must be used within BreadcrumbProvider',
      );
      return;
    }
    ctx.setHeaderActions(children);
    return () => ctx.setHeaderActions(null);
  }, [children, ctx]);

  return null;
}
