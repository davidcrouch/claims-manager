'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PublishButton({
  onClick,
  disabled,
  title = 'Publish',
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <Button
      size="icon-lg"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-amber-600 text-white hover:bg-amber-500 disabled:bg-slate-300 disabled:text-slate-500',
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Send className="h-4 w-4" />
    </Button>
  );
}
