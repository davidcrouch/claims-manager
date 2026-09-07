'use client';

import { cn } from '@/lib/utils';
import type { ApiLookup, PublishStatus } from './types';
import { displayLabelText } from './display';
import { isInsurerLineScopeStatus } from './line-scope-status';

export function LineScopeStatusBadge({ status }: { status?: ApiLookup }) {
  if (!status) return null;
  const rawName = (status.name ?? status.externalReference ?? '').toLowerCase();
  const label = displayLabelText(status.name) ?? displayLabelText(status.externalReference);
  if (!label || !rawName || rawName === 'pending') return null;
  if (!isInsurerLineScopeStatus(status)) return null;

  let cls = 'ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide';
  switch (rawName) {
    case 'accepted':
      cls += ' bg-green-100 text-green-700';
      break;
    case 'rejected':
      cls += ' bg-red-100 text-red-700 line-through';
      break;
    case 'amended':
      cls += ' bg-orange-100 text-orange-700';
      break;
    case 'referred':
      cls += ' bg-yellow-100 text-yellow-700';
      break;
    default:
      cls += ' bg-slate-100 text-slate-600';
  }

  return <span className={cls}>{label}</span>;
}

export function PublishStatusBadge({ status }: { status?: PublishStatus }) {
  if (!status) return null;
  let cls = 'ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide';
  let label: string;
  switch (status) {
    case 'excluded':
      cls += ' bg-slate-200 text-slate-600';
      label = 'not sent';
      break;
    case 'rejected':
      cls += ' bg-red-100 text-red-700';
      label = 'rejected by provider';
      break;
    case 'sent':
      return null;
    default:
      return null;
  }
  return <span className={cls}>{label}</span>;
}

/** Compact metadata chip for Type / Category columns. */
export function LineItemMetaBadge({
  label,
  tone = 'slate',
}: {
  label?: string | null;
  tone?: 'slate' | 'blue';
}) {
  const text = label?.trim();
  if (!text) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-slate-100 text-slate-700',
      )}
      title={text}
    >
      {text}
    </span>
  );
}
