import type { TaskAction } from '@/types/api';

export type ActionRenderResult =
  | { type: 'drawer'; component: string; props: Record<string, unknown> }
  | { type: 'navigate'; href: string };

/**
 * Resolve a detail URL for an entity, given entityType and optional entityId.
 * Falls back to the job page when no specific entity is targeted.
 */
function entityHref(ctx: TaskAction['context']): string {
  const { entityType, entityId, jobId } = ctx;

  if (entityId) {
    switch (entityType) {
      case 'Quote':
        return `/quotes/${entityId}`;
      case 'Invoice':
        return `/invoices/${entityId}`;
      case 'WorkOrder':
        return `/work-orders/${entityId}`;
      case 'Proposal':
        return `/proposals/${entityId}`;
      case 'RFQ':
        return `/rfqs/${entityId}`;
      case 'Bill':
        return `/bills/${entityId}`;
      case 'Report':
        return jobId ? `/jobs/${jobId}?tab=reports` : `/reports/${entityId}`;
    }
  }

  if (jobId) return `/jobs/${jobId}`;
  return '/tasks';
}

const ACTION_RENDERERS: Record<
  string,
  (ctx: TaskAction['context']) => ActionRenderResult
> = {
  create_appointment: (ctx) => ({
    type: 'drawer',
    component: 'AppointmentFormDrawer',
    props: { jobId: ctx.jobId, claimId: ctx.claimId },
  }),

  create_invoice: (ctx) => ({
    type: 'drawer',
    component: 'InvoiceFormDrawer',
    props: { jobId: ctx.jobId, claimId: ctx.claimId },
  }),

  upload_document: (ctx) => ({
    type: 'drawer',
    component: 'JournalFileUploadDrawer',
    props: { jobId: ctx.jobId },
  }),

  review_entity: (ctx) => ({
    type: 'navigate',
    href: entityHref(ctx),
  }),

  view_entity: (ctx) => ({
    type: 'navigate',
    href: entityHref(ctx),
  }),

  publish_quote: (ctx) => ({
    type: 'navigate',
    href: ctx.entityId
      ? `/quotes/${ctx.entityId}`
      : ctx.jobId
        ? `/jobs/${ctx.jobId}?tab=quotes`
        : '/quotes',
  }),
};

/**
 * Resolve how to render a task action CTA.
 * Returns null for unknown actionKeys — caller should show no CTA.
 */
export function renderTaskAction(
  action: TaskAction,
): ActionRenderResult | null {
  const renderer = ACTION_RENDERERS[action.actionKey];
  return renderer ? renderer(action.context) : null;
}
