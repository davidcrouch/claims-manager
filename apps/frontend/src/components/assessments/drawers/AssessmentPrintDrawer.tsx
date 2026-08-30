'use client';

import { PrintDocumentDrawer } from '@/components/shared/PrintDocumentDrawer';

export interface AssessmentPrintDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id?: string;
  assessmentId?: string;
  entityId?: string;
  jobId?: string;
  companionChatOpen?: boolean;
}

export function AssessmentPrintDrawer({
  open,
  onOpenChange,
  id,
  assessmentId,
  entityId,
  jobId,
  companionChatOpen,
}: AssessmentPrintDrawerProps) {
  const resolvedId = entityId || assessmentId || id || '';

  return (
    <PrintDocumentDrawer
      open={open}
      onOpenChange={onOpenChange}
      documentType="assessment"
      entityId={resolvedId}
      jobId={jobId}
      companionChatOpen={companionChatOpen}
    />
  );
}
