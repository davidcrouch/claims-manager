'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export interface CanvasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  claimId?: string;
  /** Leave a clear strip for an already-open companion chat drawer. */
  companionChatOpen?: boolean;
  aiAssistEnabled?: boolean;
  [key: string]: unknown;
}

export interface DrawerRegistryEntry {
  loader: () => Promise<{ default: ComponentType<CanvasDrawerProps> }>;
  title: string;
  defaultProps?: Record<string, unknown>;
}

export const drawerRegistry: Record<string, DrawerRegistryEntry> = {
  QuoteFormDrawer: {
    title: 'Create Estimate',
    defaultProps: { jobId: '' },
    loader: () =>
      import('@/components/forms/QuoteFormDrawer').then((m) => ({
        default: m.QuoteFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  TaskFormDrawer: {
    title: 'Create Task',
    loader: () =>
      import('@/components/forms/TaskFormDrawer').then((m) => ({
        default: m.TaskFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  ContactFormDrawer: {
    title: 'Create Contact',
    loader: () =>
      import('@/components/contacts/ContactFormDrawer').then((m) => ({
        default: m.ContactFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
};

export const LazyQuoteFormDrawer = dynamic(
  () => import('@/components/forms/QuoteFormDrawer').then((m) => m.QuoteFormDrawer),
  { ssr: false },
);

export const LazyTaskFormDrawer = dynamic(
  () => import('@/components/forms/TaskFormDrawer').then((m) => m.TaskFormDrawer),
  { ssr: false },
);

export const LazyContactFormDrawer = dynamic(
  () => import('@/components/contacts/ContactFormDrawer').then((m) => m.ContactFormDrawer),
  { ssr: false },
);

export async function loadCanvasComponent(
  name: string,
): Promise<ComponentType<CanvasDrawerProps> | null> {
  const entry = drawerRegistry[name];
  if (!entry) return null;
  const mod = await entry.loader();
  return mod.default;
}

export function getCanvasComponentTitle(name: string): string {
  return drawerRegistry[name]?.title ?? name;
}
