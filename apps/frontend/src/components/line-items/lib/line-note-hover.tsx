'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function hasLineNote(note?: string | null): boolean {
  return typeof note === 'string' && note.trim().length > 0;
}

export function useLineNoteHover(note?: string | null, enabled?: boolean) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const active = !!enabled && hasLineNote(note);

  const handlers = active
    ? {
        onMouseEnter: (e: React.MouseEvent) => {
          setPos({ x: e.clientX, y: e.clientY });
          setOpen(true);
        },
        onMouseMove: (e: React.MouseEvent) => {
          setPos({ x: e.clientX, y: e.clientY });
        },
        onMouseLeave: () => setOpen(false),
      }
    : {};

  const popup =
    open && active && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-md whitespace-pre-wrap break-words rounded-md bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-lg"
            style={{
              left: Math.min(pos.x + 14, window.innerWidth - 320),
              top: Math.min(pos.y + 16, window.innerHeight - 120),
            }}
          >
            {note}
          </div>,
          document.body,
        )
      : null;

  return { handlers, popup };
}

export function NoteHoverWrap({
  note,
  enabled,
  className,
  onClick,
  children,
  ...rest
}: {
  note?: string | null;
  enabled?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const noteHover = useLineNoteHover(note, enabled);
  return (
    <>
      {noteHover.popup}
      <div className={className} {...noteHover.handlers} onClick={onClick} {...rest}>
        {children}
      </div>
    </>
  );
}
