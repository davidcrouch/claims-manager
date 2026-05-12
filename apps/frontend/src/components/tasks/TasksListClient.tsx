'use client';

import { Construction } from 'lucide-react';

export function TasksListClient() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
      </div>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Construction className="size-12 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold tracking-tight">Tasks View</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          The standalone cross-entity tasks view is coming soon. Task management
          currently works within individual job and claim detail pages.
        </p>
      </div>
    </div>
  );
}
