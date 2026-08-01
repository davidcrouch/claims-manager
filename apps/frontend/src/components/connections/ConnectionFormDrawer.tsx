'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PROVIDER_CATALOGUE,
  type ProviderCode,
} from '@/components/providers/provider-catalogue';
import { CrunchworkConnectionCreateForm } from '@/components/providers/crunchwork/CrunchworkConnectionCreateForm';
import type { ConnectionSummary } from '@/types/api';

export interface ConnectionFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConnections: ConnectionSummary[];
}

export function ConnectionFormDrawer({
  open,
  onOpenChange,
  existingConnections,
}: ConnectionFormDrawerProps) {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState<ProviderCode | ''>('');
  const [connectionName, setConnectionName] = useState('');
  const [environment, setEnvironment] = useState<'staging' | 'production'>(
    'staging',
  );

  const entry = PROVIDER_CATALOGUE.find((p) => p.code === selectedCode);
  const existingForProvider = existingConnections.filter(
    (c) => c.providerCode === selectedCode,
  );

  function reset() {
    setSelectedCode('');
    setConnectionName('');
    setEnvironment('staging');
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function handleCreated() {
    close();
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
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
                Add Connection
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
            Select a provider and configure connection credentials.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-20 py-8">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-x-4">
              <div className="space-y-1.5">
                <Label>Connection Name</Label>
                <Input
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  placeholder={entry ? `e.g. ${entry.name} Production` : ''}
                  disabled={!entry}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Provider <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={selectedCode}
                  onValueChange={(v) => v && setSelectedCode(v as ProviderCode)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_CATALOGUE.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {existingForProvider.length > 0 && (
                  <p className="text-xs text-amber-600">
                    {existingForProvider.length} existing connection
                    {existingForProvider.length !== 1 ? 's' : ''} — this adds another.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select
                  value={environment}
                  onValueChange={(v) =>
                    v && setEnvironment(v as 'staging' | 'production')
                  }
                  disabled={!entry}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCode === 'crunchwork' && (
              <CrunchworkConnectionCreateForm
                connectionName={connectionName}
                environment={environment}
                onCancel={close}
                onCreated={handleCreated}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
