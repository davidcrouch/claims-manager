'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

export type CreateSubmitPhase = 'idle' | 'creating' | 'opening';

/**
 * Navigate to a newly created entity.
 * Prefer a hard navigation after server-action creates: soft push often loses
 * to list-page revalidation and can sit behind a cold route compile for a long time.
 */
export function navigateToCreated(
  _router: { push: (href: string) => void },
  href: string,
): void {
  if (typeof window !== 'undefined') {
    window.location.assign(href);
    return;
  }
  _router.push(href);
}

export function useCreateSubmitPhase() {
  const [phase, setPhase] = useState<CreateSubmitPhase>('idle');
  const startCreating = useCallback(() => setPhase('creating'), []);
  const startOpening = useCallback(() => setPhase('opening'), []);
  const resetPhase = useCallback(() => setPhase('idle'), []);
  return {
    phase,
    busy: phase !== 'idle',
    startCreating,
    startOpening,
    resetPhase,
  };
}

export function CreateSubmitOverlay({
  phase,
  entityLabel,
}: {
  phase: CreateSubmitPhase;
  entityLabel: string;
}) {
  if (phase === 'idle' || typeof document === 'undefined') return null;

  const opening = phase === 'opening';

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-8 py-7 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-900">
          {opening ? `Opening ${entityLabel}…` : `Creating ${entityLabel}…`}
        </p>
        <p className="text-xs text-slate-500">
          {opening
            ? `Taking you to the new ${entityLabel}.`
            : `Please wait while we set up this ${entityLabel}.`}
        </p>
      </div>
    </div>,
    document.body,
  );
}
