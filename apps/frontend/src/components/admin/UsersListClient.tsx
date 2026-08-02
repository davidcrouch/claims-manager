'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Shield,
  UserCog,
  UserMinus,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  listOrgRolesAction,
  listOrgUsersAction,
  removeOrgUserAction,
  resendInviteAction,
  updateOrgUserStatusAction,
} from '@/app/(app)/admin/users/actions';
import type { AvailableRole, OrgMember } from '@/types/api';
import { InviteUserDrawer } from './InviteUserDrawer';
import { EditUserRolesDrawer } from './EditUserRolesDrawer';

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'active') return 'bg-emerald-50 text-emerald-700';
  if (normalized === 'invited') return 'bg-amber-50 text-amber-700';
  if (normalized === 'disabled') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-50 text-slate-600';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function displayName(member: OrgMember): string {
  return (
    member.name ||
    [member.givenName, member.familyName].filter(Boolean).join(' ') ||
    member.email ||
    'Unknown user'
  );
}

export function UsersListClient() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<OrgMember | null>(null);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [memberRows, roleRows] = await Promise.all([
      listOrgUsersAction(),
      listOrgRolesAction(),
    ]);
    setMembers(memberRows);
    setRoles(roleRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function upsertMember(member: OrgMember) {
    setMembers((current) => {
      const idx = current.findIndex((m) => m.id === member.id);
      if (idx === -1) return [...current, member];
      const next = [...current];
      next[idx] = member;
      return next;
    });
  }

  function handleResend(member: OrgMember) {
    setMenuUserId(null);
    startTransition(async () => {
      const result = await resendInviteAction(member);
      if (!result.success) {
        alert(result.error ?? 'Failed to resend invite');
        return;
      }
      if (result.member) upsertMember(result.member);
      alert('Invitation resent');
    });
  }

  function handleToggleStatus(member: OrgMember) {
    setMenuUserId(null);
    const nextStatus = member.status.toLowerCase() === 'disabled' ? 'Active' : 'Disabled';
    startTransition(async () => {
      const result = await updateOrgUserStatusAction(member.id, nextStatus);
      if (!result.success || !result.member) {
        alert(result.error ?? 'Failed to update status');
        return;
      }
      upsertMember(result.member);
    });
  }

  function handleRemove(member: OrgMember) {
    setMenuUserId(null);
    if (!window.confirm(`Remove ${displayName(member)} from this organisation?`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeOrgUserAction(member.id);
      if (!result.success) {
        alert(result.error ?? 'Failed to remove user');
        return;
      }
      setMembers((current) => current.filter((m) => m.id !== member.id));
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={UserCog}
          title="Users"
          total={members.length}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => setInviteOpen(true)}
            disabled={isPending}
          >
            <Plus className="mr-1 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center">
            <UserCog className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No users yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Invite teammates to join this organisation.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Email</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Role</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Last login</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {displayName(member)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {member.roles.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          member.roles.map((role) => (
                            <span
                              key={role}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                            >
                              {roles.find((r) => r.key === role)?.name ?? role}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClass(member.status)}`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(member.lastLoginAt)}
                    </td>
                    <td className="relative px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setMenuUserId((current) =>
                            current === member.id ? null : member.id,
                          )
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      {menuUserId === member.id && (
                        <div className="absolute right-4 z-10 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setMenuUserId(null);
                              setEditMember(member);
                            }}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Edit roles
                          </button>
                          {member.status.toLowerCase() === 'invited' && (
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                              onClick={() => handleResend(member)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Resend invite
                            </button>
                          )}
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => handleToggleStatus(member)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            {member.status.toLowerCase() === 'disabled'
                              ? 'Enable user'
                              : 'Disable user'}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            onClick={() => handleRemove(member)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        availableRoles={roles}
        onInvited={(member) => upsertMember(member)}
      />
      <EditUserRolesDrawer
        open={!!editMember}
        onOpenChange={(open) => {
          if (!open) setEditMember(null);
        }}
        member={editMember}
        availableRoles={roles}
        onSaved={(member) => upsertMember(member)}
      />
    </div>
  );
}
