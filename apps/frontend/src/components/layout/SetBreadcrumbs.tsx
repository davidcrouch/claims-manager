'use client';

import { useEffect } from 'react';
import { useBreadcrumbs } from './BreadcrumbProvider';
import type { BreadcrumbItem } from '@/components/ui/breadcrumbs';

export interface SetBreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Client component that sets breadcrumbs on mount.
 * Use at the top of each page to provide page-specific breadcrumbs.
 */
export function SetBreadcrumbs({ items }: SetBreadcrumbsProps) {
  const { setItems } = useBreadcrumbs();

  useEffect(() => {
    setItems(items);
    return () => setItems([]);
  }, [items, setItems]);

  return null;
}
