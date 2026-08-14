'use client';

import { Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';

const EMAIL_NOTIFICATIONS = [
  'New claim received',
  'Job status changed',
  'Invoice submitted',
  'Work order issued',
  'Task overdue',
] as const;

export function NotificationsPageClient() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Bell}
          title="Notifications"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex-1 px-6 pb-6 pt-4" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Email Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {EMAIL_NOTIFICATIONS.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
                >
                  <span className="text-sm">{item}</span>
                  <div
                    className="h-5 w-9 rounded-full bg-muted/50"
                    title="Toggle will be functional once the notifications API is connected"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Notification preferences will be configurable once the notifications API is connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
