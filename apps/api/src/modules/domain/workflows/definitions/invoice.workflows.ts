import type { WorkflowDefinition } from '../workflow.interface';

export const invoiceStandard: WorkflowDefinition = {
  entity: 'invoice',
  name: 'standard',
  description: 'Invoice lifecycle: draft → submitted → approved/declined → paid',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      label: 'Draft',
      transitions: [
        {
          to: 'submitted',
          action: 'submit',
          onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'submitted',
      label: 'Submitted',
      transitions: [
        { to: 'approved', action: 'approve', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'approved',
      label: 'Approved',
      transitions: [
        { to: 'paid', action: 'pay', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    { id: 'paid', label: 'Paid', isFinal: true, transitions: [] },
    { id: 'declined', label: 'Declined', isFinal: true, transitions: [] },
  ],
};
