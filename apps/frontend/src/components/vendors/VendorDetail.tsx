'use client';

import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Vendor } from '@/types/api';

export function VendorPageHeader({ vendor }: { vendor: Vendor }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
      <h1 className="truncate text-lg font-semibold leading-tight">{vendor.name}</h1>
      {vendor.externalReference && (
        <span className="font-mono text-xs text-muted-foreground">
          · {vendor.externalReference}
        </span>
      )}
    </div>
  );
}

export function VendorDetail({ vendor: _vendor }: { vendor: Vendor }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Vendor allocation for jobs will be available in Phase 4.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
