'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { listOrgUsersForSelectAction } from '@/app/(app)/mutations';
import { commitColumnFilterSelection } from '@/components/shared/list-filters';
import { cn } from '@/lib/utils';
import type { OrgUserOption } from '@/components/forms/OrgUserSelect';

export type ScheduleUserFilterValue =
  | { mode: 'all' }
  | { mode: 'none' }
  | { mode: 'ids'; ids: string[] };

function triggerLabel(params: {
  value: ScheduleUserFilterValue;
  users: OrgUserOption[];
  loading: boolean;
}): string {
  if (params.loading) return 'Loading users…';
  const { value } = params;
  if (value.mode === 'all') return 'All users';
  if (value.mode === 'none') return 'No users';
  const selected = params.users.filter((u) => value.ids.includes(u.id));
  if (selected.length === 0) return 'No users';
  if (selected.length === 1) return selected[0].name;
  return `${selected[0].name} +${selected.length - 1}`;
}

export function ScheduleUserFilter({
  value,
  onChange,
  className,
}: {
  value: ScheduleUserFilterValue;
  onChange: (next: ScheduleUserFilterValue) => void;
  className?: string;
}) {
  const [users, setUsers] = useState<OrgUserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    listOrgUsersForSelectAction().then((rows) => {
      if (cancelled) return;
      setUsers(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (value.mode === 'all') {
      setDraft(new Set(users.map((u) => u.id)));
    } else if (value.mode === 'none') {
      setDraft(new Set());
    } else {
      setDraft(new Set(value.ids));
    }
  }, [open, value, users]);

  const label = useMemo(
    () => triggerLabel({ value, users, loading }),
    [value, users, loading],
  );

  const toggleDraft = (userId: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleApply = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const committed = commitColumnFilterSelection({
      next: draft,
      optionCount: users.length,
    });
    if (!committed.active) {
      onChange({ mode: 'all' });
    } else if (committed.selected.size === 0) {
      onChange({ mode: 'none' });
    } else {
      onChange({ mode: 'ids', ids: [...committed.selected] });
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={loading}
        className={cn(
          'inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        aria-label="Filter schedule by user"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[240px] w-[var(--anchor-width)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">Users</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraft(new Set(users.map((u) => u.id)));
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              All
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraft(new Set());
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              None
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[280px] overflow-y-auto">
          {users.map((user) => {
            const isChecked = draft.has(user.id);
            return (
              <DropdownMenuItem
                key={user.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleDraft(user.id);
                }}
                closeOnClick={false}
                className="justify-between gap-3"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span
                    className={cn(
                      'block truncate text-sm',
                      !isChecked && 'text-slate-400',
                    )}
                  >
                    {user.name}
                  </span>
                  {user.email ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  ) : null}
                </span>
                {isChecked ? (
                  <Check className="h-4 w-4 shrink-0 text-blue-600" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })}
          {!loading && users.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">No users</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <button
            type="button"
            onClick={handleApply}
            className="w-full rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            Apply
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
