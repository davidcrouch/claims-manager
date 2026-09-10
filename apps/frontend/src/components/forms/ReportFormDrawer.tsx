'use client';

import { CrunchworkReportUnavailableDialog } from '@/components/reports/CrunchworkReportUnavailableDialog';

export interface ReportFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  claimId?: string | null;
}

/**
 * Report creation currently depends on the Crunchwork Report API, which is
 * not operational. Callers keep the same open/onOpenChange contract; we show
 * an information dialog instead of a create form.
 */
export function ReportFormDrawer({
  open,
  onOpenChange,
}: ReportFormDrawerProps) {
  return (
    <CrunchworkReportUnavailableDialog open={open} onOpenChange={onOpenChange} />
  );
}
