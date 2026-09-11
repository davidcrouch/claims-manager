'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  UserCog,
  UserMinus,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import {
  SearchInput,
  SortTabs,
  SortableColumnHeader,
  StatusFilterMenu,
  TableEmptyRow,
  commitColumnFilterSelection,
  compareValues,
  type SortOption,
  type StatusOption,
} from '@/components/shared/list-filters';
import {
  listOrgRolesAction,
  listOrgUsersAction,
  removeOrgUserAction,
  resendInviteAction,
  updateOrgUserStatusAction,
} from '@/app/(app)/admin/users/actions';
import { useRequirePermission } from '@/components/providers/PermissionsProvider';
import type { AvailableRole, OrgMember } from '@/types/api';
import { InviteUserDrawer } from './InviteUserDrawer';
import { EditUserDrawer } from './EditUserDrawer';
import { toast } from 'sonner';

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'lastLoginAt', label: 'Last login' },
  { key: 'status', label: 'Status' },
];

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'Active', name: 'Active' },
  { id: 'Invited', name: 'Invited' },
  { id: 'Disabled', name: 'Disabled' },
];

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

function normalizeStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower === 'active') return 'Active';
  if (lower === 'invited') return 'Invited';
  if (lower === 'disabled') return 'Disabled';
  return status;
}

export function UsersListClient() {
  const requireInvite = useRequirePermission('org.users.invite', 'invite users');
  const requireManage = useRequirePermission('org.users.manage', 'manage users');
  const requireRemove = useRequirePermission('org.users.remove', 'remove users');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<OrgMember | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());

  const statusFilterOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => option.id),
    [],
  );

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
    if (!requireInvite()) return;
    startTransition(async () => {
      const result = await resendInviteAction(member);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to resend invite');
        return;
      }
      if (result.member) upsertMember(result.member);
      toast.success('Invitation resent');
    });
  }

  function handleToggleStatus(member: OrgMember) {
    if (!requireManage()) return;
    const nextStatus = normalizeStatus(member.status) === 'Disabled' ? 'Active' : 'Disabled';
    startTransition(async () => {
      const result = await updateOrgUserStatusAction(member.id, nextStatus);
      if (!result.success || !result.member) {
        toast.error(result.error ?? 'Failed to update status');
        return;
      }
      upsertMember(result.member);
    });
  }

  function handleRemove(member: OrgMember) {
    if (!requireRemove()) return;
    if (!window.confirm(`Remove ${displayName(member)} from this organisation?`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeOrgUserAction(member.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to remove user');
        return;
      }
      setMembers((current) => current.filter((m) => m.id !== member.id));
      if (editMember?.id === member.id) setEditMember(null);
    });
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortOrder(field === 'name' || field === 'email' ? 'asc' : 'desc');
  }

  function applyStatusFilter(next: Set<string>) {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: statusFilterOptions.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
  }

  const roleOptions: StatusOption[] = useMemo(
    () => roles.map((role) => ({ id: role.key, name: role.name })),
    [roles],
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = members.filter((member) => {
      if (query) {
        const name = displayName(member).toLowerCase();
        const email = (member.email ?? '').toLowerCase();
        if (!name.includes(query) && !email.includes(query)) return false;
      }
      if (statusFilterActive && !statusFilter.has(normalizeStatus(member.status))) {
        return false;
      }
      if (roleFilter.size > 0 && !member.roles.some((role) => roleFilter.has(role))) {
        return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      if (sortField === 'email') {
        return compareValues(a.email, b.email, sortOrder);
      }
      if (sortField === 'lastLoginAt') {
        return compareValues(a.lastLoginAt, b.lastLoginAt, sortOrder);
      }
      if (sortField === 'status') {
        return compareValues(
          normalizeStatus(a.status),
          normalizeStatus(b.status),
          sortOrder,
        );
      }
      return compareValues(displayName(a), displayName(b), sortOrder);
    });

    return rows;
  }, [members, search, statusFilter, statusFilterActive, roleFilter, sortField, sortOrder]);

  const breakdown = useMemo(
    () => computeStatusBreakdown(members, (member) => normalizeStatus(member.status)),
    [members],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={UserCog}
          title="Users"
          total={members.length}
          showing={filteredMembers.length}
          search={search}
          statusSelectedCount={statusFilterActive ? statusFilter.size : 0}
          breakdown={breakdown}
          accent="slate"
        />
      </SetPageHeader>

      <SetHeaderActions>
          <Button
            size="default"
            onClick={() => {
              if (!requireInvite()) return;
              setInviteOpen(true);
            }}
            disabled={isPending}
            className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Invite User
          </Button>
        </SetHeaderActions>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search users by name or email..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={STATUS_OPTIONS}
            selected={statusFilterActive ? statusFilter : new Set()}
            onSelectionChange={(id, checked) => {
              const working = statusFilterActive
                ? new Set(statusFilter)
                : new Set();
              if (checked) working.add(id);
              else working.delete(id);
              applyStatusFilter(working);
            }}
            onClearAll={() => applyStatusFilter(new Set())}
            onSelectAll={() => applyStatusFilter(new Set(statusFilterOptions))}
            triggerEmptyLabel="All statuses"
            menuTitle="Filter by status"
            itemNoun={{ singular: 'status', plural: 'statuses' }}
          />
          <StatusFilterMenu
            options={roleOptions}
            selected={roleFilter}
            onSelectionChange={(id, checked) => {
              setRoleFilter((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClearAll={() => setRoleFilter(new Set())}
            onSelectAll={() => setRoleFilter(new Set(roleOptions.map((o) => o.id)))}
            triggerEmptyLabel="All roles"
            menuTitle="Filter by role"
            itemNoun={{ singular: 'role', plural: 'roles' }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <SortableColumnHeader
                    columnKey="name"
                    label="Name"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <SortableColumnHeader
                    columnKey="email"
                    label="Email"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3">Role</th>
                  <SortableColumnHeader
                    columnKey="status"
                    label="Status"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    filter={{
                      options: statusFilterOptions,
                      selected: statusFilterActive
                        ? statusFilter
                        : new Set(statusFilterOptions),
                      active: statusFilterActive,
                      onApply: applyStatusFilter,
                      menuTitle: 'Filter by status',
                      itemNoun: { singular: 'status', plural: 'statuses' },
                    }}
                  />
                  <SortableColumnHeader
                    columnKey="lastLoginAt"
                    label="Last login"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.length === 0 ? (
                  <TableEmptyRow
                    colSpan={6}
                    label={
                      members.length === 0
                        ? 'No users yet. Invite teammates to join this organisation.'
                        : 'No users match the current search or filters.'
                    }
                  />
                ) : (
                  filteredMembers.map((member) => {
                    const isSelected = editMember?.id === member.id;
                    return (
                      <tr
                        key={member.id}
                        onClick={() => setEditMember(member)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                          isSelected ? 'bg-slate-50' : ''
                        }`}
                      >
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
                            {normalizeStatus(member.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(member.lastLoginAt)}
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48 min-w-48">
                              <DropdownMenuItem onClick={() => setEditMember(member)}>
                                <UserCog className="h-3.5 w-3.5" />
                                Edit user
                              </DropdownMenuItem>
                              {normalizeStatus(member.status) === 'Invited' && (
                                  <DropdownMenuItem onClick={() => handleResend(member)}>
                                    <Mail className="h-3.5 w-3.5" />
                                    Resend invite
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuItem onClick={() => handleToggleStatus(member)}>
                                <UserX className="h-3.5 w-3.5" />
                                {normalizeStatus(member.status) === 'Disabled'
                                  ? 'Enable user'
                                  : 'Disable user'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleRemove(member)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        availableRoles={roles}
        onInvited={(member) => {
          upsertMember(member);
          toast.success(`Invitation sent to ${member.email}`);
        }}
      />
      <EditUserDrawer
        open={!!editMember}
        onOpenChange={(open) => {
          if (!open) setEditMember(null);
        }}
        member={editMember}
        availableRoles={roles}
        onSaved={(member) => {
          upsertMember(member);
          toast.success(`Updated ${displayName(member)}`);
        }}
      />
    </div>
  );
}
