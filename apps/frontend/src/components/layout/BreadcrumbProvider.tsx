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
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<BreadcrumbItem[]>([]);
  const setItems = useCallback((newItems: BreadcrumbItem[]) => {
    setItemsState(newItems);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ items, setItems }}>
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

export function BreadcrumbConsumer() {
  const { items } = useBreadcrumbs();
  return <Breadcrumbs items={items} />;
}
