import { CircleCheck, CircleX } from 'lucide-react';
import { asBool } from './format';

export function BoolPill({ value }: { value: unknown }) {
  const b = asBool(value);
  if (b === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ' +
        (b
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')
      }
    >
      {b ? <CircleCheck className="h-3 w-3" /> : <CircleX className="h-3 w-3" />}
      {b ? 'Yes' : 'No'}
    </span>
  );
}
