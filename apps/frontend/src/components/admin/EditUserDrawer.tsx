'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateOrgUserAction } from '@/app/(app)/admin/users/actions';
import { useHasPermission } from '@/components/providers/PermissionsProvider';
import type { AvailableRole, OrgMember, UpdateOrgUserPayload } from '@/types/api';

interface EditUserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: OrgMember | null;
  availableRoles: AvailableRole[];
  onSaved?: (member: OrgMember) => void;
}

function normalizeStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'invited') return 'Invited';
  if (lower === 'disabled') return 'Disabled';
  return status;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function EditUserDrawer({
  open,
  onOpenChange,
  member,
  availableRoles,
  onSaved,
}: EditUserDrawerProps) {
  const canManage = useHasPermission('org.users.manage');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [status, setStatus] = useState('Active');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInvited = normalizeStatus(member?.status ?? '') === 'Invited';

  const statusItems = useMemo(() => {
    if (isInvited) {
      return { Invited: 'Invited', Active: 'Active', Disabled: 'Disabled' };
    }
    return { Active: 'Active', Disabled: 'Disabled' };
  }, [isInvited]);

  useEffect(() => {
    if (!open || !member) return;
    setGivenName(member.givenName ?? '');
    setFamilyName(member.familyName ?? '');
    setRoles([...member.roles]);
    setStatus(normalizeStatus(member.status));
    setError(null);
  }, [open, member]);

  function toggleRole(key: string) {
    setRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  }

  function handleSubmit() {
    if (!member) return;
    if (roles.length === 0) {
      setError('Select at least one role');
      return;
    }

    const payload: UpdateOrgUserPayload = {
      givenName: givenName.trim(),
      familyName: familyName.trim(),
      roles,
    };
    const nextStatus = normalizeStatus(status);
    if (nextStatus === 'Active' || nextStatus === 'Disabled') {
      payload.status = nextStatus;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateOrgUserAction(member.id, payload);
      if (!result.success || !result.member) {
        setError(result.error ?? 'Failed to update user');
        return;
      }
      onSaved?.(result.member);
      onOpenChange(false);
    });
  }

  const displayName =
    member?.name ||
    [member?.givenName, member?.familyName].filter(Boolean).join(' ') ||
    member?.email ||
    'User';

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit User"
      description={displayName}
      icon={<UserCog className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-user-given">Given name</Label>
              <Input
                id="edit-user-given"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                placeholder="Jane"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-user-family">Family name</Label>
              <Input
                id="edit-user-family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Smith"
                disabled={!canManage}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              value={member?.email ?? ''}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Email is used for sign-in and cannot be changed here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-user-status">Status</Label>
            <Select
              value={status || null}
              onValueChange={(value) => {
                if (value) setStatus(value);
              }}
              items={statusItems}
              disabled={!canManage}
            >
              <SelectTrigger id="edit-user-status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(statusItems).map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isInvited && (
              <p className="text-xs text-muted-foreground">
                This person has not accepted their invitation yet.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No roles available.</p>
              ) : (
                availableRoles.map((role) => {
                  const selected = roles.includes(role.key);
                  return (
                    <button
                      key={role.key}
                      type="button"
                      onClick={() => canManage && toggleRole(role.key)}
                      disabled={!canManage}
                      className={
                        selected
                          ? 'rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-70'
                          : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-70'
                      }
                    >
                      {role.name}
                    </button>
                  );
                })
              )}
              {roles
                .filter((key) => !availableRoles.some((role) => role.key === key))
                .map((key) => (
                  <span
                    key={key}
                    className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                    title="Assigned outside the organisation role catalogue"
                  >
                    {key}
                  </span>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Joined</p>
              <p className="text-sm text-slate-700">{formatDate(member?.joinedAt ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500">Last login</p>
              <p className="text-sm text-slate-700">{formatDate(member?.lastLoginAt ?? null)}</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          {canManage ? 'Cancel' : 'Close'}
        </Button>
        {canManage && (
          <Button onClick={handleSubmit} disabled={isPending || !member}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
