'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { displayLabelText } from './display';
import { hasLineNote } from './line-note-hover';

export const LINE_DETAIL_HOVER_DELAY_MS = 300;

export type LineDetailHoverContent = {
  title?: string | null;
  component?: string | null;
  description?: string | null;
  /** Shown after description whenever present. */
  note?: string | null;
  /** When true, omit component even if present (e.g. catalogue mode). */
  hideComponent?: boolean;
};

function resolveDetail(content: LineDetailHoverContent) {
  const title = content.title?.trim() || undefined;
  const component = content.hideComponent
    ? undefined
    : displayLabelText(content.component);
  const description = content.description?.trim() || undefined;
  const note = hasLineNote(content.note) ? content.note!.trim() : undefined;
  const hasDetail = !!(title || component || description || note);
  return { title, component, description, note, hasDetail };
}

function LineDetailTooltipBody({
  title,
  component,
  description,
  note,
}: {
  title?: string;
  component?: string;
  description?: string;
  note?: string;
}) {
  return (
    <div className="space-y-1.5">
      {title && (
        <div className="text-sm font-semibold leading-snug text-white">{title}</div>
      )}
      {component && (
        <div className="text-xs leading-snug text-slate-200">
          <span className="font-medium text-slate-400">Component</span>
          <div className="mt-0.5 whitespace-pre-wrap break-words">{component}</div>
        </div>
      )}
      {description && (
        <div className="text-xs leading-snug text-slate-200">
          <span className="font-medium text-slate-400">Description</span>
          <div className="mt-0.5 whitespace-pre-wrap break-words">{description}</div>
        </div>
      )}
      {note && (
        <div className="border-t border-slate-600 pt-1.5 text-xs leading-snug text-slate-200">
          <span className="font-medium text-slate-400">Note</span>
          <div className="mt-0.5 whitespace-pre-wrap break-words">{note}</div>
        </div>
      )}
    </div>
  );
}

export function useLineDetailHover(content: LineDetailHoverContent, enabled = true) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolved = resolveDetail(content);
  const active = !!enabled && resolved.hasDetail;

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Close if content becomes empty while open
  useEffect(() => {
    if (!active) {
      clearTimer();
      setOpen(false);
    }
  }, [active, clearTimer]);

  const handlers = active
    ? {
        onMouseEnter: (e: React.MouseEvent) => {
          setPos({ x: e.clientX, y: e.clientY });
          clearTimer();
          timerRef.current = setTimeout(() => setOpen(true), LINE_DETAIL_HOVER_DELAY_MS);
        },
        onMouseMove: (e: React.MouseEvent) => {
          setPos({ x: e.clientX, y: e.clientY });
        },
        onMouseLeave: () => {
          clearTimer();
          setOpen(false);
        },
      }
    : {};

  const popup =
    open && active && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-sm rounded-md bg-slate-900 px-3 py-2.5 text-left shadow-lg"
            style={{
              left: Math.min(pos.x + 14, window.innerWidth - 340),
              top: Math.min(pos.y + 16, window.innerHeight - 200),
            }}
          >
            <LineDetailTooltipBody
              title={resolved.title}
              component={resolved.component}
              description={resolved.description}
              note={resolved.note}
            />
          </div>,
          document.body,
        )
      : null;

  return { handlers, popup, active };
}

export function LineDetailHoverWrap({
  title,
  component,
  description,
  note,
  hideComponent,
  enabled = true,
  className,
  onClick,
  children,
  ...rest
}: LineDetailHoverContent & {
  enabled?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>) {
  const detailHover = useLineDetailHover(
    { title, component, description, note, hideComponent },
    enabled,
  );
  return (
    <>
      {detailHover.popup}
      <div className={className} {...detailHover.handlers} onClick={onClick} {...rest}>
        {children}
      </div>
    </>
  );
}
