/**
 * Seed script for RBAC roles, permissions, and role-permission mappings.
 * Run: npx tsx src/scripts/seed-rbac.ts
 */
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

interface RoleDef {
  roleName: string;
  scope: string;
  label: string;
  description: string;
  isSystem: boolean;
  isDefault: boolean;
  sortOrder: number;
}

interface PermissionDef {
  permissionName: string;
  label: string;
  description: string;
  category: string;
  scope: string;
  resourceGroup?: string;
}

const ROLES: RoleDef[] = [
  {
    roleName: 'platform_admin',
    scope: 'platform',
    label: 'Platform Admin',
    description: 'Full platform access with all permissions',
    isSystem: true,
    isDefault: false,
    sortOrder: 0,
  },
  {
    roleName: 'admin',
    scope: 'org',
    label: 'Admin',
    description: 'Organisation administrator with user and role management',
    isSystem: true,
    isDefault: false,
    sortOrder: 10,
  },
  {
    roleName: 'manager',
    scope: 'org',
    label: 'Manager',
    description: 'Can manage claims, jobs, and team assignments',
    isSystem: false,
    isDefault: false,
    sortOrder: 20,
  },
  {
    roleName: 'member',
    scope: 'org',
    label: 'Member',
    description: 'Standard organisation member with basic access',
    isSystem: true,
    isDefault: true,
    sortOrder: 30,
  },
  {
    roleName: 'viewer',
    scope: 'org',
    label: 'Viewer',
    description: 'Read-only access to organisation resources',
    isSystem: false,
    isDefault: false,
    sortOrder: 40,
  },
];

const PERMISSIONS: PermissionDef[] = [
  // Meta/platform permissions
  { permissionName: '*', label: 'Superuser', description: 'Wildcard - grants all permissions', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.roles.create', label: 'Create Platform Roles', description: 'Create roles at platform scope', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.roles.update', label: 'Update Platform Roles', description: 'Update roles at platform scope', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.roles.delete', label: 'Delete Platform Roles', description: 'Delete roles at platform scope', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.roles.read', label: 'Read Platform Roles', description: 'Read roles at platform scope', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.permissions.manage', label: 'Manage Permissions', description: 'Create, update, delete permission definitions', category: 'meta', scope: 'platform' },

  // Admin permissions
  { permissionName: 'org.users.manage', label: 'Manage Users', description: 'Invite, remove, and manage user roles within org', category: 'admin', scope: 'org' },
  { permissionName: 'org.users.read', label: 'Read Users', description: 'View user list and profiles', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.create', label: 'Create Org Roles', description: 'Create roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.update', label: 'Update Org Roles', description: 'Update roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.delete', label: 'Delete Org Roles', description: 'Delete roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.read', label: 'Read Org Roles', description: 'Read roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.settings.manage', label: 'Manage Org Settings', description: 'Update organisation settings', category: 'admin', scope: 'org' },

  // Feature management
  { permissionName: 'features.manage', label: 'Manage Features', description: 'CRUD feature flags and grants', category: 'admin', scope: 'org' },

  // Domain permissions
  { permissionName: 'claims.create', label: 'Create Claims', description: 'Create new insurance claims', category: 'domain', scope: 'org' },
  { permissionName: 'claims.read', label: 'Read Claims', description: 'View claims', category: 'domain', scope: 'org' },
  { permissionName: 'claims.update', label: 'Update Claims', description: 'Edit existing claims', category: 'domain', scope: 'org' },
  { permissionName: 'claims.delete', label: 'Delete Claims', description: 'Delete claims', category: 'domain', scope: 'org' },
  { permissionName: 'jobs.create', label: 'Create Jobs', description: 'Create repair/service jobs', category: 'domain', scope: 'org' },
  { permissionName: 'jobs.read', label: 'Read Jobs', description: 'View jobs', category: 'domain', scope: 'org' },
  { permissionName: 'jobs.update', label: 'Update Jobs', description: 'Edit jobs', category: 'domain', scope: 'org' },
  { permissionName: 'jobs.assign', label: 'Assign Jobs', description: 'Assign jobs to providers', category: 'domain', scope: 'org' },
  { permissionName: 'invoices.create', label: 'Create Invoices', description: 'Create invoices', category: 'domain', scope: 'org' },
  { permissionName: 'invoices.read', label: 'Read Invoices', description: 'View invoices', category: 'domain', scope: 'org' },
  { permissionName: 'invoices.approve', label: 'Approve Invoices', description: 'Approve/reject invoices', category: 'domain', scope: 'org' },
  { permissionName: 'reports.read', label: 'Read Reports', description: 'View reports and dashboards', category: 'domain', scope: 'org' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_admin: ['*'],
  admin: [
    'org.users.manage', 'org.users.read', 'org.roles.create', 'org.roles.update',
    'org.roles.delete', 'org.roles.read', 'org.settings.manage', 'features.manage',
    'claims.create', 'claims.read', 'claims.update', 'claims.delete',
    'jobs.create', 'jobs.read', 'jobs.update', 'jobs.assign',
    'invoices.create', 'invoices.read', 'invoices.approve', 'reports.read',
  ],
  manager: [
    'org.users.read', 'org.roles.read',
    'claims.create', 'claims.read', 'claims.update',
    'jobs.create', 'jobs.read', 'jobs.update', 'jobs.assign',
    'invoices.create', 'invoices.read', 'invoices.approve', 'reports.read',
  ],
  member: [
    'claims.create', 'claims.read', 'claims.update',
    'jobs.read', 'jobs.update',
    'invoices.read', 'reports.read',
  ],
  viewer: [
    'claims.read', 'jobs.read', 'invoices.read', 'reports.read',
  ],
};

async function seed() {
  console.log('Seeding RBAC tables...');

  // Seed roles
  for (const role of ROLES) {
    await sql`
      INSERT INTO roles (role_name, scope, label, description, is_system, is_default, sort_order)
      VALUES (${role.roleName}, ${role.scope}, ${role.label}, ${role.description}, ${role.isSystem}, ${role.isDefault}, ${role.sortOrder})
      ON CONFLICT (role_name) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        scope = EXCLUDED.scope,
        is_system = EXCLUDED.is_system,
        is_default = EXCLUDED.is_default,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `;
    console.log(`  Role: ${role.roleName} (${role.scope})`);
  }

  // Seed permissions
  for (const perm of PERMISSIONS) {
    await sql`
      INSERT INTO permissions (permission_name, label, description, category, scope, resource_group)
      VALUES (${perm.permissionName}, ${perm.label}, ${perm.description}, ${perm.category}, ${perm.scope}, ${perm.resourceGroup ?? null})
      ON CONFLICT (permission_name) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        scope = EXCLUDED.scope,
        resource_group = EXCLUDED.resource_group,
        updated_at = NOW()
    `;
    console.log(`  Permission: ${perm.permissionName}`);
  }

  // Seed role-permission mappings
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleRows = await sql<{ id: string }[]>`SELECT id FROM roles WHERE role_name = ${roleName}`;
    if (roleRows.length === 0) {
      console.warn(`  WARNING: Role ${roleName} not found, skipping permissions`);
      continue;
    }
    const roleId = roleRows[0].id;

    // Clear existing mappings for this role
    await sql`DELETE FROM role_permissions WHERE role_id = ${roleId}`;

    for (const permName of permissionNames) {
      const permRows = await sql<{ id: string }[]>`SELECT id FROM permissions WHERE permission_name = ${permName}`;
      if (permRows.length === 0) {
        console.warn(`  WARNING: Permission ${permName} not found for role ${roleName}`);
        continue;
      }
      const permId = permRows[0].id;
      await sql`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES (${roleId}, ${permId})
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `;
    }
    console.log(`  Role ${roleName}: ${permissionNames.length} permissions assigned`);
  }

  console.log('RBAC seed complete.');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
