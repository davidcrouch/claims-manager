'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BackButtonProps {
  href: string;
  label?: string;
}

/**
 * Small back-navigation button used in detail page headers to return to the
 * parent list page. Uses the Next.js router so navigation happens client-side.
 */
export function BackButton({ href, label = 'Back' }: BackButtonProps) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={() => router.push(href)}
      className="h-7 w-7 shrink-0"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
