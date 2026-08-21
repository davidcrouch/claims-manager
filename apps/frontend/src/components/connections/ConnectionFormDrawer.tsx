'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug } from 'lucide-react';
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
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import {
  PROVIDER_CATALOGUE,
  type ProviderCode,
} from '@/components/providers/provider-catalogue';
import { CrunchworkConnectionCreateForm } from '@/components/providers/crunchwork/CrunchworkConnectionCreateForm';
import { More0EnsureConnectionCreateForm } from '@/components/providers/more0-ensure/More0EnsureConnectionCreateForm';
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

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function close() {
    handleOpenChange(false);
  }

  function handleCreated() {
    close();
    router.refresh();
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Add Connection"
      description="Select a provider and configure connection credentials."
      icon={<Unplug className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-x-4">
            <div className="space-y-1.5">
              <Label>
                Provider <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedCode}
                onValueChange={(v) => v && setSelectedCode(v as ProviderCode)}
              >
                <SelectTrigger className="w-full">
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
              <Label>Connection Name</Label>
              <Input
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder={
                  entry
                    ? `e.g. ${entry.name} Production`
                    : 'e.g. Production'
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select
                value={environment}
                onValueChange={(v) =>
                  v && setEnvironment(v as 'staging' | 'production')
                }
              >
                <SelectTrigger className="w-full">
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

          {selectedCode === 'more0-ensure' && (
            <More0EnsureConnectionCreateForm
              connectionName={connectionName}
              environment={environment}
              onCancel={close}
              onCreated={handleCreated}
            />
          )}
        </div>
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
