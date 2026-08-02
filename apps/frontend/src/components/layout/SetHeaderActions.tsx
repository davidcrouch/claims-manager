'use client';

import { useEffect, type ReactNode } from 'react';
import { useBreadcrumbs } from './BreadcrumbProvider';

export interface SetHeaderActionsProps {
  children: ReactNode;
}

/**
 * Registers action controls (e.g. Save) in the app header, rendered to the
 * left of the user avatar while the page is mounted.
 */
export function SetHeaderActions({ children }: SetHeaderActionsProps) {
  const { setHeaderActions } = useBreadcrumbs();

  useEffect(() => {
    setHeaderActions(children);
    return () => setHeaderActions(null);
  }, [children, setHeaderActions]);

  return null;
}
