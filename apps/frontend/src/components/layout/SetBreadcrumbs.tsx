'use client';

import { useEffect } from 'react';
import { useBreadcrumbsOptional } from './BreadcrumbProvider';
import type { BreadcrumbItem } from '@/components/ui/breadcrumbs';

export interface SetBreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Client component that sets breadcrumbs on mount.
 * Use at the top of each page to provide page-specific breadcrumbs.
 */
export function SetBreadcrumbs({ items }: SetBreadcrumbsProps) {
  const ctx = useBreadcrumbsOptional();

  useEffect(() => {
    if (!ctx) {
      console.error(
        '[SetBreadcrumbs] useBreadcrumbs must be used within BreadcrumbProvider',
      );
      return;
    }
    ctx.setItems(items);
    return () => ctx.setItems([]);
  }, [items, ctx]);

  return null;
}
