'use client';

import { Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import type { Vendor } from '@/types/api';

export function VendorPageHeader({ vendor }: { vendor: Vendor }) {
  return (
    <>
      <SetHeaderActions>
        <PrintButton documentType="vendor" entityId={vendor.id} />
      </SetHeaderActions>
      <PageHeaderLayout
        leading={<BackButton href="/vendors" label="Back to vendors" />}
        icon={
          <PageHeaderIcon
            icon={Building2}
            className="bg-rose-100"
            iconClassName="text-rose-600"
          />
        }
        title={vendor.name}
        topRow={
          vendor.externalReference ? (
            <span className="font-mono text-xs text-muted-foreground">
              {vendor.externalReference}
            </span>
          ) : undefined
        }
      />
    </>
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
