'use client';

import { useEffect, type ReactNode } from 'react';
import { useBreadcrumbsOptional } from './BreadcrumbProvider';

export interface SetPageHeaderProps {
  children: ReactNode;
}

/**
 * Client component that registers a rich page-header node on mount. This node
 * takes the place of breadcrumbs in the top title bar while the page is active.
 * Use this on detail pages instead of `SetBreadcrumbs` when you want a richer
 * header (title, status, context chips, etc.) in the bar.
 */
export function SetPageHeader({ children }: SetPageHeaderProps) {
  const ctx = useBreadcrumbsOptional();

  useEffect(() => {
    if (!ctx) {
      console.error(
        '[SetPageHeader] useBreadcrumbs must be used within BreadcrumbProvider',
      );
      return;
    }
    ctx.setHeaderNode(children);
    return () => ctx.setHeaderNode(null);
  }, [children, ctx]);

  return null;
}
