'use client';

import type { ReactNode } from 'react';
import { ButtonGroup } from '@/components/ui/button-group';
import { cn } from '@/lib/utils';

export function HeaderActionToolbar({
  children,
  className,
  label = 'Record actions',
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <ButtonGroup
      role="toolbar"
      aria-label={label}
      className={cn('h-9 overflow-hidden', className)}
    >
      {children}
    </ButtonGroup>
  );
}
