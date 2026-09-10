'use client';

import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CrunchworkReportUnavailableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrunchworkReportUnavailableDialog({
  open,
  onOpenChange,
}: CrunchworkReportUnavailableDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="space-y-2 pt-0.5">
              <DialogTitle className="text-xl">Reports are not available yet</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                The Crunchwork Report API is not yet operational in this environment.
                Creating or submitting a report through Crunchwork cannot be
                completed at this time. Existing reports can still be viewed.
                Please try again once report creation has been enabled, or
                contact your administrator if you need this sooner.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button className="h-9 px-4" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
