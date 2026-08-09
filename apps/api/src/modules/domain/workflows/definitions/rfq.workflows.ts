import type { WorkflowDefinition } from '../workflow.interface';

export const rfqStandard: WorkflowDefinition = {
  entity: 'rfq',
  name: 'standard',
  description: 'RFQ lifecycle: draft → sent → responded → closed',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      label: 'Draft',
      transitions: [
        {
          to: 'sent',
          action: 'send',
          guards: ['hasLineItems', 'checkMaxDepth'],
          onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'sent',
      label: 'Sent',
      transitions: [
        { to: 'responded', action: 'respond', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'cancelled', action: 'cancel', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'expired', action: 'expire', onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'responded',
      label: 'Responded',
      transitions: [
        { to: 'closed', action: 'close', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    { id: 'closed', label: 'Closed', isFinal: true, transitions: [] },
    { id: 'cancelled', label: 'Cancelled', isFinal: true, transitions: [] },
    { id: 'expired', label: 'Expired', isFinal: true, transitions: [] },
  ],
};
