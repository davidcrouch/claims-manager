import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { DashboardInboxItem } from '@/types/api';
import { InboxRow } from './InboxRow';

export function InboxQueueCard({
  title,
  count,
  href,
  items,
  emptyLabel,
  emphasizeOverdue,
}: {
  title: string;
  count?: number;
  href?: string;
  items: DashboardInboxItem[];
  emptyLabel: string;
  emphasizeOverdue?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {count != null && count > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {href && count != null && count > 0 && (
          <Link href={href} className="text-xs text-primary hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <li key={`${item.entityType}-${item.id}`}>
                <InboxRow item={item} emphasizeOverdue={emphasizeOverdue} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
