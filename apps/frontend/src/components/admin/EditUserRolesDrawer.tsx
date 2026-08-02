'use client';

import { useEffect, useState, useTransition } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { updateOrgUserRolesAction } from '@/app/(app)/admin/users/actions';
import type { AvailableRole, OrgMember } from '@/types/api';

interface EditUserRolesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: OrgMember | null;
  availableRoles: AvailableRole[];
  onSaved?: (member: OrgMember) => void;
}

export function EditUserRolesDrawer({
  open,
  onOpenChange,
  member,
  availableRoles,
  onSaved,
}: EditUserRolesDrawerProps) {
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !member) return;
    setRoles([...member.roles]);
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

    setError(null);
    startTransition(async () => {
      const result = await updateOrgUserRolesAction(member.id, roles);
      if (!result.success || !result.member) {
        setError(result.error ?? 'Failed to update roles');
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
      title="Edit Roles"
      description={displayName}
      icon={<Shield className="h-5 w-5" />}
      widthClassName="w-full max-w-lg"
    >
      <BottomFormDrawerBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => {
                const selected = roles.includes(role.key);
                return (
                  <button
                    key={role.key}
                    type="button"
                    onClick={() => toggleRole(role.key)}
                    className={
                      selected
                        ? 'rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white'
                        : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
                    }
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending || !member}>
          {isPending ? 'Saving…' : 'Save Roles'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
