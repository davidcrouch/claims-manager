import type { WorkflowDefinition } from '../workflow.interface';

export const quoteStandard: WorkflowDefinition = {
  entity: 'quote',
  name: 'standard',
  description: 'Standard estimate lifecycle: draft → approved → published (issues Proposal)',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      label: 'Draft',
      transitions: [
        { to: 'approved', action: 'approve', guards: ['hasLineItems'] },
      ],
    },
    {
      id: 'approved',
      label: 'Approved',
      transitions: [
        { to: 'published', action: 'publish', onEnter: ['issueDocument', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'published',
      label: 'Published',
      isFinal: true,
      transitions: [],
    },
  ],
};
