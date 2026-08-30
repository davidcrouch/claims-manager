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
  AssessmentCreateDrawer: {
    title: 'Create Assessment',
    defaultProps: { jobId: '' },
    loader: () =>
      import('@/components/assessments/drawers/AssessmentCreateDrawer').then((m) => ({
        default: m.AssessmentCreateDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentAttendanceDrawer: {
    title: 'Attendance',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentAttendanceDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentBuildingTabDrawer: {
    title: 'Building',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentBuildingTabDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentHabitabilityDrawer: {
    title: 'Habitability',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentHabitabilityDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentHazardsTabDrawer: {
    title: 'Hazards',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentHazardsTabDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentDamageDrawer: {
    title: 'Damage & Cause',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentDamageDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentMakeSafeDrawer: {
    title: 'Make Safe',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentMakeSafeDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentTempAccommodationDrawer: {
    title: 'Temp Accommodation',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentTempAccommodationDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentSpecialistsDrawer: {
    title: 'Specialists',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentSpecialistsDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentRecommendationDrawer: {
    title: 'Recommendation',
    loader: () =>
      import('@/components/assessments/drawers/tab-drawers').then((m) => ({
        default: m.AssessmentRecommendationDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AssessmentPrintDrawer: {
    title: 'Print assessment',
    loader: () =>
      import('@/components/assessments/drawers/AssessmentPrintDrawer').then((m) => ({
        default: m.AssessmentPrintDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  TaskDetailDrawer: {
    title: 'Edit Task',
    loader: () =>
      import('@/components/tasks/TaskDetailDrawer').then((m) => ({
        default: m.TaskDetailDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  AppointmentFormDrawer: {
    title: 'Appointment',
    loader: () =>
      import('@/components/forms/AppointmentFormDrawer').then((m) => ({
        default: m.AppointmentFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  CatalogFormDrawer: {
    title: 'Catalogue',
    loader: () =>
      import('@/components/catalog/CatalogFormDrawer').then((m) => ({
        default: m.CatalogFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  CatalogItemFormDrawer: {
    title: 'Catalogue item',
    loader: () =>
      import('@/components/catalog/CatalogItemFormDrawer').then((m) => ({
        default: m.CatalogItemFormDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  CatalogCategoriesDrawer: {
    title: 'Catalogue categories',
    loader: () =>
      import('@/components/catalog/CatalogCategoriesDrawer').then((m) => ({
        default: m.CatalogCategoriesDrawer as unknown as ComponentType<CanvasDrawerProps>,
      })),
  },
  CatalogBomDrawer: {
    title: 'Catalogue BOM',
    loader: () =>
      import('@/components/catalog/CatalogBomDrawer').then((m) => ({
        default: m.CatalogBomDrawer as unknown as ComponentType<CanvasDrawerProps>,
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
