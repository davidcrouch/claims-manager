'use client';

import type { DraggableAttributes } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export const ROW_LEAD_DRAG_W = 'w-8';
export const ROW_LEAD_CHECK_W = 'w-6';
export const ROW_LEAD_EXPAND_W = 'w-6';

/** Shared left inset + column spacing for grab / checkbox across headers and table rows. */
export const ROW_LEAD_ROW_CLS = 'flex items-center gap-0 pl-1';
export const ROW_LEAD_TD_DRAG = 'w-8 pl-1 pr-0 py-0 align-middle';
export const ROW_LEAD_TD_CHECK = 'w-6 p-0 align-middle';
export const ROW_LEAD_TD_CHECK_LEAD = 'w-6 pl-1 pr-0 py-0 align-middle';

interface RowLeadDragProps {
  show: boolean;
  attributes?: DraggableAttributes;
  listeners?: Record<string, unknown>;
  className?: string;
  iconClassName?: string;
}

export function RowLeadDrag({ show, attributes, listeners, className, iconClassName }: RowLeadDragProps) {
  if (!show) return null;
  return (
    <span
      className={cn(ROW_LEAD_DRAG_W, 'flex shrink-0 items-center justify-center', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className={cn('h-4 w-4', iconClassName)} />
      </span>
    </span>
  );
}

interface RowLeadCheckboxProps {
  show: boolean;
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: () => void;
  'aria-label'?: string;
}

export function RowLeadCheckbox({
  show,
  checked = false,
  indeterminate = false,
  onCheckedChange,
  'aria-label': ariaLabel,
}: RowLeadCheckboxProps) {
  if (!show) return null;
  return (
    <span
      className={cn(ROW_LEAD_CHECK_W, 'flex shrink-0 items-center justify-center')}
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      />
    </span>
  );
}

interface RowLeadExpandProps {
  show: boolean;
  isCollapsed: boolean;
  className?: string;
  iconClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function RowLeadExpand({ show, isCollapsed, className, iconClassName, onClick }: RowLeadExpandProps) {
  if (!show) return null;
  return (
    <span
      className={cn(ROW_LEAD_EXPAND_W, 'flex shrink-0 items-center justify-center', className)}
      onClick={onClick}
    >
      {isCollapsed ? (
        <ChevronRight className={cn('h-4 w-4', iconClassName)} />
      ) : (
        <ChevronDown className={cn('h-4 w-4', iconClassName)} />
      )}
    </span>
  );
}
