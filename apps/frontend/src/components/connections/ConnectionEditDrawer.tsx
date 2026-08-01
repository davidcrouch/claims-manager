'use client';

import { Unplug, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { CrunchworkConnectionEditForm } from '@/components/providers/crunchwork/CrunchworkConnectionEditForm';
import type { ProviderConnection } from '@/types/api';

export interface ConnectionEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: ProviderConnection;
  onSaved: () => void;
}

export function ConnectionEditDrawer({
  open,
  onOpenChange,
  connection,
  onSaved,
}: ConnectionEditDrawerProps) {
  function close() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-[70%]! max-w-none! flex-col overflow-hidden border-l p-0 sm:max-w-none!"
      >
        <div data-slot="drawer-header" className="border-b border-sidebar-border px-12 py-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                <Unplug className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="text-2xl font-semibold text-sidebar-foreground">
                Edit Connection
              </h2>
            </div>
            <button
              onClick={close}
              className="rounded-full p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground outline-none focus:ring-2 focus:ring-sidebar-ring"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-sidebar-foreground/65">
            Update credentials and configuration for{' '}
            <span className="font-medium text-sidebar-foreground">
              {connection.name}
            </span>
            .
          </p>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-20 py-8">
          {connection.providerCode === 'crunchwork' ? (
            <CrunchworkConnectionEditForm
              connection={connection}
              onCancel={close}
              onSaved={onSaved}
            />
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-700">
                No edit form registered for provider &quot;
                {connection.providerCode}&quot;.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
