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
  headerActions: ReactNode | null;
  setHeaderActions: (node: ReactNode | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<BreadcrumbItem[]>([]);
  const [headerNode, setHeaderNodeState] = useState<ReactNode | null>(null);
  const [headerActions, setHeaderActionsState] = useState<ReactNode | null>(null);

  const setItems = useCallback((newItems: BreadcrumbItem[]) => {
    setItemsState(newItems);
  }, []);

  const setHeaderNode = useCallback((node: ReactNode | null) => {
    setHeaderNodeState(node);
  }, []);

  const setHeaderActions = useCallback((node: ReactNode | null) => {
    setHeaderActionsState(node);
  }, []);

  return (
    <BreadcrumbContext.Provider
      value={{ items, setItems, headerNode, setHeaderNode, headerActions, setHeaderActions }}
    >
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
 * Non-throwing variant for register helpers (`SetPageHeader`, etc.).
 * Returns null when the provider is missing (e.g. Turbopack first-compile /
 * HMR context identity mismatch) so pages degrade instead of hard-crashing.
 */
export function useBreadcrumbsOptional() {
  return useContext(BreadcrumbContext);
}

/**
 * Renders the active page-header content. When a page registers a rich header
 * node via `SetPageHeader`, that node replaces the breadcrumbs. Otherwise, the
 * standard breadcrumbs trail (set via `SetBreadcrumbs`) is rendered.
 */
export function BreadcrumbConsumer() {
  const { items, headerNode } = useBreadcrumbs();
  if (headerNode) {
    return <div className="flex min-w-0 flex-1 items-center">{headerNode}</div>;
  }
  return <Breadcrumbs items={items} />;
}

/**
 * Renders page-registered header actions (via `SetHeaderActions`) to the left
 * of the user avatar in the app header.
 */
export function HeaderActionsConsumer() {
  const { headerActions } = useBreadcrumbs();
  if (!headerActions) return null;
  return <div className="flex shrink-0 items-center gap-2 self-stretch">{headerActions}</div>;
}
