'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { ChevronRight, Plus, Save, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  createRoleAction,
  deleteRoleAction,
  getRolePermissionsAction,
  listPermissionsAction,
  listRolesAction,
  setRolePermissionsAction,
} from '@/app/(app)/admin/roles/actions';
import type { PermissionDef, RoleDef } from '@/types/api';

const SCOPE_LABELS: Record<string, string> = {
  platform: 'Platform',
  org: 'Organisation',
};

const SCOPE_ORDER = ['platform', 'org'];

const CATEGORY_LABELS: Record<string, string> = {
  meta: 'System (RBAC Management)',
  admin: 'Administration',
  domain: 'Domain',
  ai: 'AI',
  integrations: 'Integrations',
};

function permissionGroup(perm: PermissionDef): string {
  if (perm.resourceGroup) return perm.resourceGroup;
  const name = perm.permissionName;
  if (name === '*') return 'wildcard';
  const parts = name.split('.');
  if (parts[0] === 'org' || parts[0] === 'platform' || parts[0] === 'roles') {
    return parts.slice(0, 2).join('.');
  }
  return parts[0] ?? 'other';
}

export function RolesManagementPage() {
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleDef | null>(null);
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRole, setNewRole] = useState({
    roleName: '',
    scope: 'org',
    label: '',
    description: '',
  });
  const [isPending, startTransition] = useTransition();

  const loadCatalogue = useCallback(async () => {
    setLoading(true);
    const [roleRows, permRows] = await Promise.all([
      listRolesAction(),
      listPermissionsAction(),
    ]);
    setRoles(roleRows);
    setPermissions(permRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const loadRolePermissions = useCallback((roleId: string) => {
    startTransition(async () => {
      const perms = await getRolePermissionsAction(roleId);
      setRolePermissionIds(new Set(perms.map((p) => p.id)));
      setError(null);
    });
  }, []);

  const handleSelectRole = useCallback(
    (role: RoleDef) => {
      setSelectedRole(role);
      setShowCreateForm(false);
      loadRolePermissions(role.id);
    },
    [loadRolePermissions],
  );

  const togglePermission = useCallback((permId: string) => {
    setRolePermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }, []);

  const handleSavePermissions = useCallback(() => {
    if (!selectedRole) return;
    startTransition(async () => {
      const result = await setRolePermissionsAction(
        selectedRole.id,
        Array.from(rolePermissionIds),
      );
      if (!result.success) {
        setError(result.error ?? 'Failed to save permissions');
        return;
      }
      setError(null);
      toast.success(`Permissions saved for ${selectedRole.name}`);
    });
  }, [selectedRole, rolePermissionIds]);

  const handleCreateRole = useCallback(() => {
    startTransition(async () => {
      const result = await createRoleAction({
        roleName: newRole.roleName,
        scope: newRole.scope,
        label: newRole.label,
        description: newRole.description || undefined,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to create role');
        return;
      }
      const refreshed = await listRolesAction();
      setRoles(refreshed);
      setShowCreateForm(false);
      setNewRole({ roleName: '', scope: 'org', label: '', description: '' });
      setError(null);
      toast.success(`Role ${newRole.label} created`);
    });
  }, [newRole]);

  const handleDeleteRole = useCallback(
    (role: RoleDef) => {
      if (!window.confirm(`Delete ${role.name}? This cannot be undone.`)) return;
      startTransition(async () => {
        const result = await deleteRoleAction(role.id);
        if (!result.success) {
          setError(result.error ?? 'Failed to delete role');
          return;
        }
        setRoles((prev) => prev.filter((r) => r.id !== role.id));
        if (selectedRole?.id === role.id) setSelectedRole(null);
        setError(null);
        toast.success(`Role ${role.name} deleted`);
      });
    },
    [selectedRole],
  );

  const groupedRoles = SCOPE_ORDER.reduce(
    (acc, scope) => {
      acc[scope] = roles
        .filter((r) => r.scope === scope)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return acc;
    },
    {} as Record<string, RoleDef[]>,
  );

  const groupedPermissions = permissions.reduce(
    (acc, p) => {
      const cat = p.category ?? 'domain';
      const group = permissionGroup(p);
      if (!acc[cat]) acc[cat] = {};
      if (!acc[cat][group]) acc[cat][group] = [];
      acc[cat][group].push(p);
      return acc;
    },
    {} as Record<string, Record<string, PermissionDef[]>>,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Shield}
          title="Roles & Permissions"
          total={roles.length}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex justify-end">
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => {
              setShowCreateForm(true);
              setSelectedRole(null);
            }}
            disabled={isPending}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Role
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-6 pb-6">
        <div className="w-80 shrink-0 space-y-4 overflow-y-auto">
          {SCOPE_ORDER.map((scope) => {
            const scopeRoles = groupedRoles[scope];
            if (!scopeRoles || scopeRoles.length === 0) return null;
            return (
              <div key={scope}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {SCOPE_LABELS[scope] ?? scope}
                </h3>
                <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
                  {scopeRoles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleSelectRole(role)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        selectedRole?.id === role.id
                          ? 'bg-slate-900/5 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium">{role.name}</div>
                          {role.isSystem && (
                            <span className="text-xs text-slate-500">System</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!loading && roles.length === 0 && (
            <p className="text-sm text-slate-500">No roles found.</p>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {error && (
            <div className="mb-4 shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {showCreateForm ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <h3 className="text-lg font-semibold text-slate-800">Create Role</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="role-key">Role Key</Label>
                  <Input
                    id="role-key"
                    value={newRole.roleName}
                    onChange={(e) =>
                      setNewRole((prev) => ({
                        ...prev,
                        roleName: e.target.value,
                      }))
                    }
                    placeholder="e.g. compliance_officer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-scope">Scope</Label>
                  <select
                    id="role-scope"
                    value={newRole.scope}
                    onChange={(e) =>
                      setNewRole((prev) => ({ ...prev, scope: e.target.value }))
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {SCOPE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SCOPE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-label">Display Name</Label>
                  <Input
                    id="role-label"
                    value={newRole.label}
                    onChange={(e) =>
                      setNewRole((prev) => ({ ...prev, label: e.target.value }))
                    }
                    placeholder="e.g. Compliance Officer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-description">Description</Label>
                  <Input
                    id="role-description"
                    value={newRole.description}
                    onChange={(e) =>
                      setNewRole((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateRole}
                  disabled={isPending || !newRole.roleName || !newRole.label}
                >
                  {isPending ? 'Creating…' : 'Create'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : selectedRole ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5">
              <div className="flex shrink-0 items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {selectedRole.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {SCOPE_LABELS[selectedRole.scope] ?? selectedRole.scope} scope
                    {selectedRole.isSystem && ' · System role'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!selectedRole.isSystem && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRole(selectedRole)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSavePermissions}
                    disabled={isPending}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isPending ? 'Saving…' : 'Save Permissions'}
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
                {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => {
                  const groups = groupedPermissions[cat];
                  if (!groups) return null;
                  return (
                    <div key={cat}>
                      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                        {catLabel}
                      </h4>
                      <div className="space-y-4">
                        {Object.entries(groups)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([group, perms]) => (
                            <div
                              key={group}
                              className="rounded-md border border-slate-200 bg-slate-50/50 p-3"
                            >
                              <h5 className="mb-2 text-sm font-medium capitalize text-slate-700">
                                {group.replace(/[-.]/g, ' ')}
                              </h5>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {perms.map((perm) => (
                                  <label
                                    key={perm.id}
                                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-white"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={rolePermissionIds.has(perm.id)}
                                      onChange={() => togglePermission(perm.id)}
                                      className="mt-0.5 rounded border-slate-300"
                                    />
                                    <div>
                                      <div className="text-sm text-slate-800">
                                        {perm.label}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {perm.permissionName}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              {loading
                ? 'Loading roles…'
                : 'Select a role to view and edit its permissions'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
