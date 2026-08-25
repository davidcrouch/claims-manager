'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PrintDocumentDrawer,
  type PrintReportTypeOption,
} from '@/components/shared/PrintDocumentDrawer';

interface PrintButtonProps {
  documentType: string;
  entityId: string;
  jobId?: string;
  reportTypes?: readonly PrintReportTypeOption[];
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
}

export function PrintButton({
  documentType,
  entityId,
  jobId,
  reportTypes,
  className,
  size = 'icon-lg',
}: PrintButtonProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Button
        size={size}
        onClick={() => setDrawerOpen(true)}
        className={cn(
          'bg-blue-600 text-white hover:bg-blue-500',
          className,
        )}
        title="Print PDF"
        aria-label="Print PDF"
      >
        <Printer className="h-4 w-4" />
      </Button>

      <PrintDocumentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        documentType={documentType}
        entityId={entityId}
        jobId={jobId}
        reportTypes={reportTypes}
      />
    </>
  );
}
