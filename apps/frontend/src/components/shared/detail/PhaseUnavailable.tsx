import { Clock3 } from 'lucide-react';

export function PhaseUnavailable({
  phase = 'Phase 2',
  message,
}: {
  phase?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center">
      <Clock3 className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        Available in {phase}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        {message ??
          'The API endpoint backing this view is not yet available. It will be wired up when the corresponding integration phase ships.'}
      </p>
    </div>
  );
}
