'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

function isEmptyPayload(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || trimmed === 'No data' || trimmed === 'No payload data';
}

export function CopyIconButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = isEmptyPayload(text);

  async function handleCopy(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => void handleCopy(event)}
      title={copied ? 'Copied' : `Copy ${label}`}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="inline-flex shrink-0 items-center justify-center rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function CopyablePayload({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <CopyIconButton text={text} label={label} />
      </div>
      <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-200">
        {text}
      </pre>
    </div>
  );
}
