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
        { to: 'pending_approval', action: 'submit', guards: ['hasLineItems', 'hasRecipient'] },
      ],
    },
    {
      id: 'pending_approval',
      label: 'Pending Approval',
      transitions: [
        { to: 'approved', action: 'approve' },
        { to: 'draft', action: 'reject' },
      ],
    },
    {
      id: 'approved',
      label: 'Approved',
      transitions: [
        { to: 'issued', action: 'issue', onEnter: ['issueDocument'] },
      ],
    },
    {
      id: 'issued',
      label: 'Issued',
      transitions: [
        { to: 'acknowledged', action: 'acknowledge' },
        { to: 'draft', action: 'revise' },
      ],
    },
    {
      id: 'acknowledged',
      label: 'Acknowledged',
      transitions: [
        { to: 'closed', action: 'close' },
        { to: 'draft', action: 'revise' },
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
