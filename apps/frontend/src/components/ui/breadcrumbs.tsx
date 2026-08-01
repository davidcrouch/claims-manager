'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  title: string;
  href: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.href} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-4 w-4 text-sidebar-foreground/65" aria-hidden />
            )}
            {isLast ? (
              <span className="font-medium text-sidebar-foreground">{item.title}</span>
            ) : (
              <Link
                href={item.href}
                className="text-sidebar-foreground/65 transition-colors hover:text-sidebar-foreground"
              >
                {item.title}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
