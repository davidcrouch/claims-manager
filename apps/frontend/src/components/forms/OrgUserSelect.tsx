'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listOrgUsersForSelectAction } from '@/app/(app)/mutations';
import { cn } from '@/lib/utils';

export const UNASSIGNED_USER_VALUE = '__unassigned__';

export type OrgUserOption = { id: string; name: string; email?: string };

const USER_OPTION_COLS =
  'grid w-full min-w-0 grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-4';

function UserOptionRow({
  name,
  email,
}: {
  name: string;
  email?: string | null;
}) {
  return (
    <span className={USER_OPTION_COLS}>
      <span className="truncate font-medium text-foreground">{name}</span>
      <span className="truncate text-left text-muted-foreground">
        {email?.trim() || '—'}
      </span>
    </span>
  );
}

export function OrgUserSelect({
  id = 'assignedToUserId',
  label = 'Assigned',
  value,
  onChange,
  disabled,
  showLabel = true,
  className,
}: {
  id?: string;
  label?: string;
  value?: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  const [users, setUsers] = useState<OrgUserOption[]>([]);
  const [loading, setLoading] = useState(true);

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

  const items = useMemo(() => {
    const map: Record<string, string> = { [UNASSIGNED_USER_VALUE]: 'Unassigned' };
    for (const user of users) {
      map[user.id] = user.name;
    }
    return map;
  }, [users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === value) ?? null,
    [users, value],
  );

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={value || UNASSIGNED_USER_VALUE}
        onValueChange={(next) =>
          onChange(!next || next === UNASSIGNED_USER_VALUE ? null : next)
        }
        items={items}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue placeholder={loading ? 'Loading users…' : 'Select user'}>
            {(selected: string | null) => {
              if (loading) return 'Loading users…';
              if (!selected || selected === UNASSIGNED_USER_VALUE) {
                return 'Unassigned';
              }
              return selectedUser?.name ?? items[selected] ?? 'Unassigned';
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
          className="min-w-120 w-max max-w-[min(36rem,var(--available-width))]"
        >
          <SelectGroup>
            <SelectLabel className={cn(USER_OPTION_COLS, 'px-1.5 py-2 pr-8')}>
              <span>Name</span>
              <span>Email</span>
            </SelectLabel>
            <SelectItem value={UNASSIGNED_USER_VALUE} className="py-2">
              <UserOptionRow name="Unassigned" email={null} />
            </SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id} className="py-2">
                <UserOptionRow name={user.name} email={user.email} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
