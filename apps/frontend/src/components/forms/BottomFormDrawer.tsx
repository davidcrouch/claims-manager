'use client';

import {
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export interface BottomFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}

export function BottomFormDrawer({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
}: BottomFormDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const reactId = useId();
  const titleId = `bfd-title-${reactId}`;
  const descriptionId = `bfd-description-${reactId}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="bottom-form-drawer-root"
          className="fixed inset-0 z-50"
          initial="closed"
          animate="open"
          exit="closed"
          aria-hidden={!open}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="absolute bottom-0 left-[15%] right-[15%] flex h-[90vh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-background shadow-2xl"
            variants={{ closed: { y: '100%' }, open: { y: 0 } }}
            transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.9 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-linear-to-b from-slate-50 to-white px-8 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
                  {icon}
                </div>
                <div className="flex flex-col">
                  <h2
                    id={titleId}
                    className="font-heading text-lg font-semibold leading-6 text-slate-900"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      id={descriptionId}
                      className="mt-1 text-sm text-slate-500"
                    >
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="mt-0.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export interface BottomFormDrawerBodyProps {
  children: ReactNode;
  className?: string;
}

export function BottomFormDrawerBody({
  children,
  className,
}: BottomFormDrawerBodyProps) {
  return (
    <div
      className={
        'min-h-0 flex-1 overflow-y-auto px-8 py-6' +
        (className ? ` ${className}` : '')
      }
    >
      {children}
    </div>
  );
}

export interface BottomFormDrawerFooterProps {
  children: ReactNode;
  className?: string;
}

export function BottomFormDrawerFooter({
  children,
  className,
}: BottomFormDrawerFooterProps) {
  return (
    <div
      className={
        'flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-8 py-4' +
        (className ? ` ${className}` : '')
      }
    >
      {children}
    </div>
  );
}

export interface BottomFormDrawerErrorProps {
  error: string | null;
  className?: string;
}

export function BottomFormDrawerError({
  error,
  className,
}: BottomFormDrawerErrorProps) {
  if (!error) return null;
  return (
    <p
      className={
        'mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive' +
        (className ? ` ${className}` : '')
      }
      role="alert"
    >
      {error}
    </p>
  );
}
