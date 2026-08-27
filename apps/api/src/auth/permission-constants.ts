/**
 * RBAC permission constants for @RequirePermission(P.…).
 *
 * Convention: {scope}.{resource}.{action} for scoped permissions,
 *             {resource}.{action} for domain permissions.
 */

export const P = {
  platform: {
    roles: {
      create: 'platform.roles.create',
      read: 'platform.roles.read',
      update: 'platform.roles.update',
      delete: 'platform.roles.delete',
    },
    permissions: { manage: 'platform.permissions.manage' },
    users: {
      read: 'platform.users.read',
      manage: 'platform.users.manage',
      invite: 'platform.users.invite',
    },
    integrations: { manage: 'platform.integrations.manage' },
  },
  org: {
    roles: {
      create: 'org.roles.create',
      read: 'org.roles.read',
      update: 'org.roles.update',
      delete: 'org.roles.delete',
    },
    users: {
      read: 'org.users.read',
      manage: 'org.users.manage',
      invite: 'org.users.invite',
      remove: 'org.users.remove',
    },
    settings: { manage: 'org.settings.manage' },
    integrations: { manage: 'org.integrations.manage' },
  },
  features: {
    read: 'features.read',
    manage: 'features.manage',
  },
  claims: {
    create: 'claims.create',
    read: 'claims.read',
    update: 'claims.update',
    delete: 'claims.delete',
  },
  jobs: {
    create: 'jobs.create',
    read: 'jobs.read',
    update: 'jobs.update',
    assign: 'jobs.assign',
  },
  invoices: {
    create: 'invoices.create',
    read: 'invoices.read',
    update: 'invoices.update',
    approve: 'invoices.approve',
  },
  finance: {
    read: 'finance.read',
    manage: 'finance.manage',
  },
  reports: {
    read: 'reports.read',
  },
  documents: {
    read: 'documents.read',
    manage: 'documents.manage',
  },
  filesystems: {
    read: 'filesystems.read',
    manage: 'filesystems.manage',
  },
  catalogs: {
    read: 'catalogs.read',
    manage: 'catalogs.manage',
    updateFromEstimate: 'catalogs.update-from-estimate',
  },
  contacts: {
    read: 'contacts.read',
    manage: 'contacts.manage',
  },
  journals: {
    read: 'journals.read',
    manage: 'journals.manage',
  },
  assessments: {
    read: 'assessments.read',
    manage: 'assessments.manage',
  },
  procurement: {
    read: 'procurement.read',
    manage: 'procurement.manage',
  },
  vendors: {
    read: 'vendors.read',
    manage: 'vendors.manage',
  },
  messaging: {
    read: 'messaging.read',
    send: 'messaging.send',
  },
  workflows: {
    read: 'workflows.read',
    manage: 'workflows.manage',
  },
  lookups: {
    read: 'lookups.read',
    manage: 'lookups.manage',
  },
  ai: {
    read: 'ai.read',
    manage: 'ai.manage',
    admin: 'ai.admin',
  },
  integrations: {
    read: 'integrations.read',
    manage: 'integrations.manage',
  },
} as const;
