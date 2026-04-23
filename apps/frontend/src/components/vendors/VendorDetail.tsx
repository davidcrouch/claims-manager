'use client';

import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BackButton } from '@/components/layout/BackButton';
import type { Vendor } from '@/types/api';

export function VendorPageHeader({ vendor }: { vendor: Vendor }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <BackButton href="/vendors" label="Back to vendors" />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100">
        <Building2 className="h-4 w-4 text-rose-600" />
      </span>
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
