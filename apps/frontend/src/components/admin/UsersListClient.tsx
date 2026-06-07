'use client';

import Link from 'next/link';
import { UserCog, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';

export function UsersListClient() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={UserCog}
          title="Users"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
          <Button
            size="sm"
            className="shrink-0"
            disabled
            title="User management will be available once the identity provider integration is connected"
          >
            <Plus className="mr-1 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserCog className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">User Management</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Users are synced from your identity provider. Connect your identity provider in{' '}
              <Link href="/admin/settings?tab=connections" className="text-primary hover:underline">
                Settings &rarr; Connections
              </Link>{' '}
              to see users appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
