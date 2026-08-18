'use client';

import { Unplug } from 'lucide-react';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
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
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Connection"
      description={`Update credentials and configuration for ${connection.name}.`}
      icon={<Unplug className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
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
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
