'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listOrgUsersForSelectAction } from '@/app/(app)/mutations';

export const UNASSIGNED_USER_VALUE = '__unassigned__';

export type OrgUserOption = { id: string; name: string; email?: string };

export function OrgUserSelect({
  id = 'assignedToUserId',
  label = 'Assigned',
  value,
  onChange,
  disabled,
  showLabel = true,
}: {
  id?: string;
  label?: string;
  value?: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  showLabel?: boolean;
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

  return (
    <div className="space-y-2">
      {showLabel ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={value || UNASSIGNED_USER_VALUE}
        onValueChange={(next) =>
          onChange(!next || next === UNASSIGNED_USER_VALUE ? null : next)
        }
        items={items}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={loading ? 'Loading users…' : 'Select user'}>
            {(selected: string | null) => {
              if (loading) return 'Loading users…';
              if (!selected || selected === UNASSIGNED_USER_VALUE) return 'Unassigned';
              return items[selected] ?? 'Unassigned';
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED_USER_VALUE}>Unassigned</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.email ? `${user.name} (${user.email})` : user.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
