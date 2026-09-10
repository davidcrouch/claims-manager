import type { WorkflowDefinition } from '../workflow.interface';

export const invoiceStandard: WorkflowDefinition = {
  entity: 'invoice',
  name: 'standard',
  description:
    'Invoice lifecycle: draft → reviewed → invoiced → partially paid → paid',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      label: 'Draft',
      transitions: [
        {
          to: 'reviewed',
          action: 'approve',
          onEnter: ['syncStatusLookup'],
        },
      ],
    },
    {
      id: 'reviewed',
      label: 'Reviewed',
      transitions: [
        {
          to: 'invoiced',
          action: 'submit',
          onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'],
        },
        {
          to: 'draft',
          action: 'edit',
          onEnter: ['syncStatusLookup'],
        },
      ],
    },
    {
      id: 'invoiced',
      label: 'Invoiced',
      transitions: [
        { to: 'partially_paid', action: 'receive_payment', onEnter: ['syncStatusLookup'] },
        { to: 'paid', action: 'receive_full_payment', onEnter: ['syncStatusLookup'] },
        { to: 'approved', action: 'approve', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'partially_paid',
      label: 'Partially Paid',
      transitions: [
        { to: 'partially_paid', action: 'receive_payment', onEnter: ['syncStatusLookup'] },
        { to: 'paid', action: 'receive_full_payment', onEnter: ['syncStatusLookup'] },
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
