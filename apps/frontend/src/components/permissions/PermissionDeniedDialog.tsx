'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface PermissionDeniedDialogProps {
  open: boolean;
  action?: string;
  onOpenChange: (open: boolean) => void;
}

export function PermissionDeniedDialog({
  open,
  action,
  onOpenChange,
}: PermissionDeniedDialogProps) {
  const activity = action?.trim() || 'perform this action';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="space-y-2 pt-0.5">
              <DialogTitle className="text-xl">Permission required</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                You do not have permission to {activity}. If you need access,
                contact your organisation administrator to update your role.
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
