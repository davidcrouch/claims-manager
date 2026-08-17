/**
 * Seed script for RBAC roles, permissions, and role-permission mappings.
 * Local:  pnpm db:seed-rbac:dev   (or npx tsx src/scripts/seed-rbac.ts)
 * Image:  node dist/scripts/seed-rbac.js  (Cloud Run Job seed-auth-rbac)
 */
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.trim() !== '') return url;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const ssl =
    (process.env.DB_SSL ?? 'false').toLowerCase() === 'true' ||
    (process.env.DB_SSL ?? 'false').toLowerCase() === '1';
  if (host && port && database && user && password !== undefined) {
    const sslMode = ssl ? 'sslmode=require' : 'sslmode=disable';
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${sslMode}`;
  }
  throw new Error('Set DATABASE_URL or all of DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
}

const sql = postgres(getDatabaseUrl(), { max: 1 });

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
    label: 'Organisation Admin',
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
  { permissionName: 'platform.users.read', label: 'View All Users', description: 'View users across organisations', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.users.manage', label: 'Manage Platform Users', description: 'Assign platform roles to users', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.users.invite', label: 'Invite Platform Users', description: 'Invite users to the platform organisation', category: 'meta', scope: 'platform' },
  { permissionName: 'platform.integrations.manage', label: 'Manage Platform Integrations', description: 'Platform OAuth clients and DCR', category: 'admin', scope: 'platform' },

  // Admin permissions
  { permissionName: 'org.users.manage', label: 'Manage Users', description: 'Change roles and remove org users', category: 'admin', scope: 'org' },
  { permissionName: 'org.users.invite', label: 'Invite Org Users', description: 'Invite users to the organisation', category: 'admin', scope: 'org' },
  { permissionName: 'org.users.remove', label: 'Remove Org Users', description: 'Remove members from the organisation', category: 'admin', scope: 'org' },
  { permissionName: 'org.users.read', label: 'Read Users', description: 'View user list and profiles', category: 'admin', scope: 'org' },
  { permissionName: 'org.integrations.manage', label: 'Manage Org Integrations', description: 'Org-scoped OAuth clients and DCR', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.create', label: 'Create Org Roles', description: 'Create roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.update', label: 'Update Org Roles', description: 'Update roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.delete', label: 'Delete Org Roles', description: 'Delete roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.roles.read', label: 'Read Org Roles', description: 'Read roles at org scope', category: 'admin', scope: 'org' },
  { permissionName: 'org.settings.manage', label: 'Manage Org Settings', description: 'Update organisation settings', category: 'admin', scope: 'org' },

  // Feature management
  { permissionName: 'features.read', label: 'View Feature Configuration', description: 'View feature catalogue and grants', category: 'admin', scope: 'org' },
  { permissionName: 'features.manage', label: 'Manage Features', description: 'CRUD feature flags and grants', category: 'admin', scope: 'org' },

  // Privileged role-grant guards (same model as data_cloud)
  { permissionName: 'roles.grant.platform_admin', label: 'Grant Platform Admin', description: 'Grant or revoke the platform_admin role', category: 'meta', scope: 'platform' },
  { permissionName: 'roles.grant.admin', label: 'Grant Organisation Admin', description: 'Grant or revoke the admin role', category: 'meta', scope: 'org' },

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
  { permissionName: 'invoices.update', label: 'Update Invoices', description: 'Edit existing invoices', category: 'domain', scope: 'org' },
  { permissionName: 'invoices.approve', label: 'Approve Invoices', description: 'Approve/reject invoices', category: 'domain', scope: 'org' },
  { permissionName: 'finance.read', label: 'Read Finance', description: 'View finance summaries and ledgers', category: 'domain', scope: 'org' },
  { permissionName: 'finance.manage', label: 'Manage Finance', description: 'Update finance records', category: 'domain', scope: 'org' },
  { permissionName: 'reports.read', label: 'Read Reports', description: 'View reports and dashboards', category: 'domain', scope: 'org' },
  { permissionName: 'documents.read', label: 'Read Documents', description: 'View and download documents', category: 'domain', scope: 'org' },
  { permissionName: 'documents.manage', label: 'Manage Documents', description: 'Upload, categorise, and delete documents', category: 'domain', scope: 'org' },
  { permissionName: 'filesystems.read', label: 'Read Filesystems', description: 'View filesystem layouts and categories', category: 'domain', scope: 'org' },
  { permissionName: 'filesystems.manage', label: 'Manage Filesystems', description: 'Configure filesystems and templates', category: 'domain', scope: 'org' },
  { permissionName: 'catalogs.read', label: 'Read Catalogues', description: 'View catalogue items and types', category: 'domain', scope: 'org' },
  { permissionName: 'catalogs.manage', label: 'Manage Catalogues', description: 'Create and update catalogues', category: 'domain', scope: 'org' },
  { permissionName: 'contacts.read', label: 'Read Contacts', description: 'View contacts', category: 'domain', scope: 'org' },
  { permissionName: 'contacts.manage', label: 'Manage Contacts', description: 'Create and update contacts', category: 'domain', scope: 'org' },
  { permissionName: 'journals.read', label: 'Read Journals', description: 'View journals and pages', category: 'domain', scope: 'org' },
  { permissionName: 'journals.manage', label: 'Manage Journals', description: 'Create and update journals', category: 'domain', scope: 'org' },
  { permissionName: 'assessments.read', label: 'Read Assessments', description: 'View assessments', category: 'domain', scope: 'org' },
  { permissionName: 'assessments.manage', label: 'Manage Assessments', description: 'Create, publish, and delete assessments', category: 'domain', scope: 'org' },
  { permissionName: 'procurement.read', label: 'Read Procurement', description: 'View quotes, RFQs, proposals, work orders, and bills', category: 'domain', scope: 'org' },
  { permissionName: 'procurement.manage', label: 'Manage Procurement', description: 'Create and update procurement records', category: 'domain', scope: 'org' },
  { permissionName: 'vendors.read', label: 'Read Vendors', description: 'View vendors', category: 'domain', scope: 'org' },
  { permissionName: 'vendors.manage', label: 'Manage Vendors', description: 'Update vendor links', category: 'domain', scope: 'org' },
  { permissionName: 'messaging.read', label: 'Read Messaging', description: 'View messages and notifications', category: 'domain', scope: 'org' },
  { permissionName: 'messaging.send', label: 'Send Messaging', description: 'Send messages and mark notifications read', category: 'domain', scope: 'org' },
  { permissionName: 'workflows.read', label: 'Read Workflows', description: 'View tasks, appointments, schedules, and pipelines', category: 'domain', scope: 'org' },
  { permissionName: 'workflows.manage', label: 'Manage Workflows', description: 'Update tasks, appointments, schedules, and pipelines', category: 'domain', scope: 'org' },
  { permissionName: 'lookups.read', label: 'Read Lookups', description: 'View lookup values', category: 'domain', scope: 'org' },
  { permissionName: 'lookups.manage', label: 'Manage Lookups', description: 'Create lookup values', category: 'domain', scope: 'org' },

  // AI permissions
  { permissionName: 'ai.read', label: 'Read AI', description: 'View AI chat and agents', category: 'ai', scope: 'org' },
  { permissionName: 'ai.manage', label: 'Manage AI', description: 'Use AI chat and configure personal agents', category: 'ai', scope: 'org' },
  { permissionName: 'ai.admin', label: 'Administer AI', description: 'Manage org-wide AI settings and agents', category: 'ai', scope: 'org' },

  // Integration permissions
  { permissionName: 'integrations.read', label: 'Read Integrations', description: 'View MCP integrations and connections', category: 'integrations', scope: 'org' },
  { permissionName: 'integrations.manage', label: 'Manage Integrations', description: 'Configure MCP integrations and connections', category: 'integrations', scope: 'org' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  platform_admin: ['*'],
  admin: [
    'org.users.manage', 'org.users.invite', 'org.users.remove', 'org.users.read',
    'org.roles.create', 'org.roles.update', 'org.roles.delete', 'org.roles.read',
    'org.settings.manage', 'org.integrations.manage',
    'features.read', 'features.manage', 'roles.grant.admin',
    'claims.create', 'claims.read', 'claims.update', 'claims.delete',
    'jobs.create', 'jobs.read', 'jobs.update', 'jobs.assign',
    'invoices.create', 'invoices.read', 'invoices.update', 'invoices.approve',
    'finance.read', 'finance.manage', 'reports.read',
    'documents.read', 'documents.manage',
    'filesystems.read', 'filesystems.manage',
    'catalogs.read', 'catalogs.manage',
    'contacts.read', 'contacts.manage',
    'journals.read', 'journals.manage',
    'assessments.read', 'assessments.manage',
    'procurement.read', 'procurement.manage',
    'vendors.read', 'vendors.manage',
    'messaging.read', 'messaging.send',
    'workflows.read', 'workflows.manage',
    'lookups.read', 'lookups.manage',
    'ai.read', 'ai.manage', 'ai.admin',
    'integrations.read', 'integrations.manage',
  ],
  manager: [
    'org.users.read', 'org.roles.read',
    'claims.create', 'claims.read', 'claims.update',
    'jobs.create', 'jobs.read', 'jobs.update', 'jobs.assign',
    'invoices.create', 'invoices.read', 'invoices.update', 'invoices.approve',
    'finance.read', 'finance.manage', 'reports.read',
    'documents.read', 'documents.manage',
    'filesystems.read', 'filesystems.manage',
    'catalogs.read', 'catalogs.manage',
    'contacts.read', 'contacts.manage',
    'journals.read', 'journals.manage',
    'assessments.read', 'assessments.manage',
    'procurement.read', 'procurement.manage',
    'vendors.read', 'vendors.manage',
    'messaging.read', 'messaging.send',
    'workflows.read', 'workflows.manage',
    'lookups.read', 'lookups.manage',
    'ai.read', 'ai.manage',
    'integrations.read', 'integrations.manage',
  ],
  member: [
    'claims.create', 'claims.read', 'claims.update',
    'jobs.read', 'jobs.update',
    'invoices.read', 'finance.read', 'reports.read',
    'documents.read', 'documents.manage',
    'filesystems.read',
    'catalogs.read',
    'contacts.read', 'contacts.manage',
    'journals.read', 'journals.manage',
    'assessments.read', 'assessments.manage',
    'procurement.read', 'procurement.manage',
    'vendors.read',
    'messaging.read', 'messaging.send',
    'workflows.read', 'workflows.manage',
    'lookups.read',
    'ai.read', 'ai.manage',
    'integrations.read',
  ],
  viewer: [
    'claims.read', 'jobs.read', 'invoices.read', 'finance.read', 'reports.read',
    'documents.read', 'filesystems.read', 'catalogs.read', 'contacts.read',
    'journals.read', 'assessments.read', 'procurement.read', 'vendors.read',
    'messaging.read', 'workflows.read', 'lookups.read',
    'ai.read',
    'integrations.read',
  ],
};

interface FeatureDef {
  featureKey: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

const FEATURES: FeatureDef[] = [
  { featureKey: 'ai.chat', label: 'AI Chat', description: 'Conversational AI assistant for claims', defaultEnabled: true },
  { featureKey: 'ai.agents', label: 'AI Agents', description: 'Custom AI agents and configurations', defaultEnabled: true },
  { featureKey: 'ai.skills', label: 'AI Skills', description: 'Reusable AI skill definitions', defaultEnabled: true },
  { featureKey: 'ai.connections', label: 'AI Connections', description: 'MCP integrations and tool connections', defaultEnabled: true },
];

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

  // Seed features
  for (const feature of FEATURES) {
    await sql`
      INSERT INTO features (feature_key, label, description, default_enabled)
      VALUES (${feature.featureKey}, ${feature.label}, ${feature.description}, ${feature.defaultEnabled})
      ON CONFLICT (feature_key) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        default_enabled = EXCLUDED.default_enabled,
        updated_at = NOW()
    `;
    console.log(`  Feature: ${feature.featureKey}`);
  }

  // Backfill org members who have no RBAC assignment (pre-enforcement users).
  const backfilled = await sql`
    INSERT INTO user_role_assignments (user_id, organization_id, role_name)
    SELECT ou.user_id, ou.organization_id, 'admin'
    FROM organization_users ou
    WHERE NOT EXISTS (
      SELECT 1
      FROM user_role_assignments ura
      WHERE ura.user_id = ou.user_id
        AND ura.organization_id = ou.organization_id
        AND ura.revoked_at IS NULL
    )
    ON CONFLICT (user_id, organization_id, role_name) DO UPDATE SET revoked_at = NULL
    RETURNING user_id
  `;
  console.log(`  Backfilled ${backfilled.length} org members with admin role`);

  console.log('RBAC seed complete.');

  if ((process.env.ENSURE_PLATFORM_ADMIN_PASSWORD ?? '').trim()) {
    console.log('Seeding Ensure Construction platform admin...');
    const { seedEnsureConstructionPlatformAdmin } = await import(
      './seed-ensure-construction-admin.js'
    );
    const admin = await seedEnsureConstructionPlatformAdmin();
    console.log(
      `  Ensure Construction platform admin ready userId=${admin.userId} orgId=${admin.organizationId}`,
    );
  } else {
    console.log(
      '  Skipping Ensure Construction platform admin (ENSURE_PLATFORM_ADMIN_PASSWORD not set)',
    );
  }

  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
