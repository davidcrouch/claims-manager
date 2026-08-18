'use client';

import {
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import { useEntityDrawerOptional } from '@/components/layout/EntityDrawerHost';
import {
  FORM_DRAWER_BESIDE_CHAT_WIDTH_CLASS,
  FORM_DRAWER_COMPANION_LEFT_CLASS,
  FORM_DRAWER_WIDTH_CLASS,
} from './form-drawer-layout';

export interface BottomFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  /** Tailwind width class for the panel. Defaults to 65% viewport width. */
  widthClassName?: string;
  aiAssistEnabled?: boolean;
  onAIAssist?: () => void;
  /** When true, backdrop leaves the left strip clear for a companion chat drawer. */
  companionChatOpen?: boolean;
  /** Block Escape, backdrop click, and the header close button (e.g. while creating). */
  preventClose?: boolean;
}

export function BottomFormDrawer({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  widthClassName = FORM_DRAWER_WIDTH_CLASS,
  aiAssistEnabled,
  onAIAssist,
  companionChatOpen = false,
  preventClose = false,
}: BottomFormDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const reactId = useId();
  const layout = useEntityDrawerOptional();
  const chatBeside = companionChatOpen || !!layout?.companionChatOpen;
  const titleId = `bfd-title-${reactId}`;
  const descriptionId = `bfd-description-${reactId}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  const registerFormDrawer = layout?.registerFormDrawer;
  useEffect(() => {
    if (!registerFormDrawer) return;
    registerFormDrawer(reactId, open);
    return () => registerFormDrawer(reactId, false);
  }, [open, reactId, registerFormDrawer]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) onOpenChange(false);
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange, preventClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="form-drawer-root"
          className="fixed inset-0 z-50"
          initial="closed"
          animate="open"
          exit="closed"
          aria-hidden={!open}
        >
          <motion.div
            className={
              chatBeside
                ? `absolute inset-y-0 right-0 ${FORM_DRAWER_COMPANION_LEFT_CLASS} bg-slate-900/40 backdrop-blur-sm`
                : 'absolute inset-0 bg-slate-900/40 backdrop-blur-sm'
            }
            variants={{ closed: { opacity: 0 }, open: { opacity: 1 } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => {
              if (!preventClose) onOpenChange(false);
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className={`absolute inset-y-0 right-0 flex h-full flex-col overflow-hidden border-l border-slate-200 bg-background shadow-2xl transition-[width] duration-300 ease-in-out ${
              chatBeside ? FORM_DRAWER_BESIDE_CHAT_WIDTH_CLASS : widthClassName
            }`}
            variants={{ closed: { x: '100%' }, open: { x: 0 } }}
            transition={{ type: 'spring', damping: 30, stiffness: 280, mass: 0.9 }}
          >
            <div
              data-slot="drawer-header"
              className="flex items-start justify-between gap-4 border-b border-sidebar-border px-8 py-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
                  {icon}
                </div>
                <div className="flex flex-col">
                  <h2
                    id={titleId}
                    className="font-heading text-lg font-semibold leading-6 text-sidebar-foreground"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      id={descriptionId}
                      className="mt-1 text-sm text-sidebar-foreground/65"
                    >
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {aiAssistEnabled && (
                  <button
                    type="button"
                    onClick={onAIAssist}
                    aria-label="AI Assist"
                    className="mt-0.5 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    <Sparkles className="h-5 w-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!preventClose) onOpenChange(false);
                  }}
                  aria-label="Close"
                  disabled={preventClose}
                  className="mt-0.5 rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-40"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
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
        'min-h-0 flex-1 overflow-y-auto px-12 py-6' +
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
        'flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-12 py-4' +
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
