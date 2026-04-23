'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { BreadcrumbItem } from '@/components/ui/breadcrumbs';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  setItems: (items: BreadcrumbItem[]) => void;
  headerNode: ReactNode | null;
  setHeaderNode: (node: ReactNode | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<BreadcrumbItem[]>([]);
  const [headerNode, setHeaderNodeState] = useState<ReactNode | null>(null);

  const setItems = useCallback((newItems: BreadcrumbItem[]) => {
    setItemsState(newItems);
  }, []);

  const setHeaderNode = useCallback((node: ReactNode | null) => {
    setHeaderNodeState(node);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ items, setItems, headerNode, setHeaderNode }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error('[BreadcrumbProvider.useBreadcrumbs] useBreadcrumbs must be used within BreadcrumbProvider');
  }
  return ctx;
}

/**
 * Renders the active page-header content. When a page registers a rich header
 * node via `SetPageHeader`, that node replaces the breadcrumbs. Otherwise, the
 * standard breadcrumbs trail (set via `SetBreadcrumbs`) is rendered.
 */
export function BreadcrumbConsumer() {
  const { items, headerNode } = useBreadcrumbs();
  if (headerNode) {
    return <div className="min-w-0 flex-1">{headerNode}</div>;
  }
  return <Breadcrumbs items={items} />;
}
