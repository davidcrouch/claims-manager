'use client';

import { useEffect, useState, useTransition } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { inviteOrgUserAction } from '@/app/(app)/admin/users/actions';
import type { AvailableRole, OrgMember } from '@/types/api';

interface InviteUserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableRoles: AvailableRole[];
  onInvited?: (member: OrgMember) => void;
}

export function InviteUserDrawer({
  open,
  onOpenChange,
  availableRoles,
  onInvited,
}: InviteUserDrawerProps) {
  const [email, setEmail] = useState('');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setGivenName('');
    setFamilyName('');
    setRoles(availableRoles[0] ? [availableRoles[0].key] : []);
    setError(null);
  }, [open, availableRoles]);

  function toggleRole(key: string) {
    setRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  }

  function handleSubmit() {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (roles.length === 0) {
      setError('Select at least one role');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await inviteOrgUserAction({
        email: email.trim(),
        givenName: givenName.trim() || undefined,
        familyName: familyName.trim() || undefined,
        roles,
      });
      if (!result.success || !result.member) {
        setError(result.error ?? 'Failed to send invite');
        return;
      }
      onInvited?.(result.member);
      onOpenChange(false);
    });
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Invite User"
      description="Send an invitation email with a role assignment."
      icon={<UserPlus className="h-5 w-5" />}
      widthClassName="w-full max-w-lg"
    >
      <BottomFormDrawerBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-given">Given name</Label>
              <Input
                id="invite-given"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-family">Family name</Label>
              <Input
                id="invite-family"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="Smith"
              />
            </div>
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
                })
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Sending…' : 'Send Invite'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
