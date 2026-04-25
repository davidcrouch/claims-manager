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
        side="bottom"
        showCloseButton={false}
        className="mx-auto w-[65%]! h-[90vh]! flex flex-col overflow-hidden rounded-t-xl border-x border-t p-0 data-starting-style:translate-y-full! data-ending-style:translate-y-full! transition-transform! duration-300! ease-out!"
      >
        <div className="border-b border-slate-100 bg-slate-50/50 px-12 py-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
                <Unplug className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Edit Connection
              </h2>
            </div>
            <button
              onClick={close}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 outline-none focus:ring-2 focus:ring-slate-900"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Update credentials and configuration for{' '}
            <span className="font-medium text-slate-700">
              {connection.name}
            </span>
            .
          </p>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-16 py-8">
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
