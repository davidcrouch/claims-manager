'use client';

import { useState } from 'react';
import { EntityMessagesTab } from '@/components/shared/EntityMessagesTab';
import { MessageFormDrawer } from '@/components/forms/MessageFormDrawer';

export function JobCommunicationsTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId?: string | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-4">
      <EntityMessagesTab
        entityId={jobId}
        entityType="job"
        onSendMessage={() => setDrawerOpen(true)}
      />
      <MessageFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobId={jobId}
        claimId={claimId}
      />
    </div>
  );
}
