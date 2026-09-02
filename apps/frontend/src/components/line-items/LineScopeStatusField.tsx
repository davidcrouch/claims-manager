'use client';

import { cn } from '@/lib/utils';
import { useLineItems } from './LineItemsProvider';
import {
  DEFAULT_LINE_SCOPE_STATUS,
  isInsurerLineScopeStatus,
  LINE_SCOPE_STATUS_OPTIONS,
  resolveLineScopeStatusValue,
} from './lib/line-scope-status';
import type { ApiLookup } from './lib/types';
import { LI_TD_CELL } from './lib/table-parts';
import { displayLabelText } from './lib/display';

interface LineScopeStatusFieldProps {
  rowKey: string;
  status?: ApiLookup;
  className?: string;
}

export function LineScopeStatusField({ rowKey, status, className }: LineScopeStatusFieldProps) {
  const { config, isReadOnly, editInputs, handleInputChange } = useLineItems();

  if (!config.showLineScopeStatusColumn) return null;

  const currentValue =
    editInputs[rowKey]?.lineScopeStatus ?? resolveLineScopeStatusValue(status);

  if (isInsurerLineScopeStatus(status)) {
    const label = displayLabelText(status?.name) ?? displayLabelText(status?.externalReference);
    return (
      <td data-col="lineScopeStatus" className={cn('whitespace-nowrap text-xs text-slate-600', LI_TD_CELL, className)}>
        {label ?? '—'}
      </td>
    );
  }

  if (isReadOnly) {
    return (
      <td data-col="lineScopeStatus" className={cn('whitespace-nowrap text-xs text-slate-600', LI_TD_CELL, className)}>
        {currentValue || DEFAULT_LINE_SCOPE_STATUS}
      </td>
    );
  }

  return (
    <td
      data-col="lineScopeStatus"
      className={cn('whitespace-nowrap text-xs', LI_TD_CELL, className)}
      onClick={(e) => e.stopPropagation()}
    >
      <select
        className="w-full min-w-0 bg-transparent text-sm text-slate-700 outline-none"
        value={currentValue || DEFAULT_LINE_SCOPE_STATUS}
        aria-label="Line status"
        onChange={(e) => handleInputChange(rowKey, 'lineScopeStatus', e.target.value)}
      >
        {LINE_SCOPE_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </td>
  );
}

/** Compact status select for assembly header rows (not in the item table grid). */
export function LineScopeStatusAssemblyField({
  rowKey,
  status,
}: {
  rowKey: string;
  status?: ApiLookup;
}) {
  const { config, isReadOnly, editInputs, handleInputChange } = useLineItems();

  if (!config.showLineScopeStatusColumn) return null;

  const currentValue =
    editInputs[rowKey]?.lineScopeStatus ?? resolveLineScopeStatusValue(status);

  if (isInsurerLineScopeStatus(status)) {
    const label = displayLabelText(status?.name) ?? displayLabelText(status?.externalReference);
    return (
      <span className="shrink-0 text-xs text-slate-600" title="Insurer line status">
        {label}
      </span>
    );
  }

  if (isReadOnly) {
    return (
      <span className="shrink-0 text-xs text-slate-600">
        {currentValue || DEFAULT_LINE_SCOPE_STATUS}
      </span>
    );
  }

  return (
    <label
      className="ml-3 flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="uppercase tracking-wide text-slate-500">Status</span>
      <select
        className="rounded border border-slate-200 bg-white px-2 py-1 text-sm font-normal normal-case text-slate-700 outline-none focus:border-slate-400"
        value={currentValue || DEFAULT_LINE_SCOPE_STATUS}
        aria-label="Assembly status"
        onChange={(e) => handleInputChange(rowKey, 'lineScopeStatus', e.target.value)}
      >
        {LINE_SCOPE_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
