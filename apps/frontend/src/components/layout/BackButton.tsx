'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LIST_URL_KEY = 'backbutton:lastListUrl';

/**
 * Persist the current list URL (including page/filter query params) so
 * detail-page back buttons can restore it.  Call this from list pages.
 */
export function useRememberListUrl(basePath: string) {
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `${LIST_URL_KEY}:${basePath}`,
        window.location.pathname + window.location.search,
      );
    } catch { /* private mode / quota */ }
  }, [basePath]);
}

export interface BackButtonProps {
  href: string;
  label?: string;
}

/**
 * Small back-navigation button used in detail page headers to return to the
 * parent list page.  Prefers `router.back()` when browser history contains a
 * same-origin page; otherwise restores the last remembered list URL (incl.
 * page & filters via sessionStorage), falling back to the static `href` prop.
 */
export function BackButton({ href, label = 'Back' }: BackButtonProps) {
  const router = useRouter();
  const hasHistoryRef = useRef(false);

  useEffect(() => {
    hasHistoryRef.current =
      typeof window !== 'undefined' && window.history.length > 1;
  }, []);

  const handleClick = useCallback(() => {
    if (hasHistoryRef.current) {
      router.back();
      return;
    }
    const basePath = '/' + href.replace(/^\//, '').split('?')[0];
    try {
      const stored = sessionStorage.getItem(`${LIST_URL_KEY}:${basePath}`);
      if (stored) {
        router.push(stored);
        return;
      }
    } catch { /* ignore */ }
    router.push(href);
  }, [router, href]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={handleClick}
      className="h-7 w-7 shrink-0"
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
