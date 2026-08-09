import type { WorkflowDefinition } from '../workflow.interface';

export const purchaseOrderStandard: WorkflowDefinition = {
  entity: 'purchase_order',
  name: 'standard',
  description: 'Standard PO lifecycle: draft → approval → issue → acknowledgement',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      label: 'Draft',
      transitions: [
        { to: 'pending_approval', action: 'submit', guards: ['hasLineItems', 'hasRecipient'], onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'pending_approval',
      label: 'Pending Approval',
      transitions: [
        { to: 'approved', action: 'approve', onEnter: ['syncStatusLookup'] },
        { to: 'draft', action: 'reject', onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'approved',
      label: 'Approved',
      transitions: [
        { to: 'issued', action: 'issue', guards: ['checkMaxDepth'], onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'issued',
      label: 'Issued',
      transitions: [
        { to: 'acknowledged', action: 'acknowledge', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'draft', action: 'revise', onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'acknowledged',
      label: 'Acknowledged',
      transitions: [
        { to: 'closed', action: 'close', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'draft', action: 'revise', onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'closed',
      label: 'Closed',
      isFinal: true,
      transitions: [],
    },
  ],
};
