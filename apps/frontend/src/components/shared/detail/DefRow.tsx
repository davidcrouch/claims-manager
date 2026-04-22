import type { ReactNode } from 'react';

export function DefRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 py-1.5 text-sm border-b border-border/40 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground wrap-break-word">
        {value == null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}
