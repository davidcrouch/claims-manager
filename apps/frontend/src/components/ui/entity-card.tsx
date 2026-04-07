'use client';

import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';

export interface EntityCardProps {
  href: string;
  icon: LucideIcon;
  accentColor?: string;
  title: string;
  subtitle?: string;
  description?: string;
  footer?: React.ReactNode;
  topRight?: React.ReactNode;
  badge?: string;
  className?: string;
}

export function EntityCard({
  href,
  icon: Icon,
  accentColor = 'border-l-blue-500',
  title,
  subtitle,
  description,
  footer,
  topRight,
  badge,
  className,
}: EntityCardProps) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          'h-32 min-w-[265px] max-w-[322px] border-l-4 transition-colors hover:bg-muted/50',
          accentColor,
          className
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge && <StatusBadge status={badge} />}
            {topRight}
          </div>
        </CardHeader>
        <CardContent className="py-1">
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {description}
            </p>
          )}
        </CardContent>
        {footer && (
          <CardFooter className="py-1 text-xs text-muted-foreground">
            {footer}
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}
