'use client';

import { Building2 } from 'lucide-react';
import { EntityPanel } from '@/components/ui/entity-panel';
import { EntityCard } from '@/components/ui/entity-card';
import type { Vendor } from '@/types/api';

export interface VendorsListClientProps {
  vendors: Vendor[];
}

export function VendorsListClient({ vendors }: VendorsListClientProps) {
  return (
    <EntityPanel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => (
          <EntityCard
            key={v.id}
            href={`/vendors/${v.id}`}
            icon={Building2}
            accentColor="border-l-emerald-500"
            title={v.name}
            subtitle={v.externalReference ?? ''}
          />
        ))}
      </div>
      {vendors.length === 0 && (
        <p className="text-sm text-muted-foreground py-8">No vendors found.</p>
      )}
    </EntityPanel>
  );
}
