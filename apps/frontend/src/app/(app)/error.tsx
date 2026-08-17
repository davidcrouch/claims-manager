'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

function isConnectionFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('unavailable') ||
    m.includes('network') ||
    m.includes('timeout')
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  const connectionFailure = isConnectionFailure(error.message);

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
      <h2 className="text-lg font-semibold">
        {connectionFailure ? 'API unavailable' : 'Something went wrong'}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {connectionFailure
          ? 'The backend could not be reached. It may be restarting — try again in a moment.'
          : error.message}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
