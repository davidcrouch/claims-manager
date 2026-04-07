'use client';

import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Vendor } from '@/types/api';

export function VendorDetail({ vendor }: { vendor: Vendor }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          {vendor.name}
        </h1>
        {vendor.externalReference && (
          <p className="mt-2 text-sm text-muted-foreground">
            Reference: {vendor.externalReference}
          </p>
        )}
      </div>
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
