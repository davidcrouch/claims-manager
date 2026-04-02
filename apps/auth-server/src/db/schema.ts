/**
 * auth-server local DB schema (Drizzle) – minimal tables for auth and organization resolution.
 * Compatible with shared schema column names so the same Postgres can be used if desired.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  status: text('status').notNull(),
  object: text('object').notNull(),
  created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull(),
  modified: timestamp('modified', { withTimezone: true, mode: 'string' }).notNull(),
  createdBy: uuid('created_by'),
  modifiedBy: uuid('modified_by'),
  isDisabled: boolean('is_disabled').default(false).notNull(),
  config: jsonb('config'),
});

export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    rawProfile: jsonb('raw_profile').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_user_identities_provider_subject').on(table.provider, table.providerSubject),
  ]
);

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  object: text('object').notNull(),
  created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull(),
  modified: timestamp('modified', { withTimezone: true, mode: 'string' }).notNull(),
  createdBy: uuid('created_by').notNull(),
  modifiedBy: uuid('modified_by').notNull(),
  orgCode: text('org_code').notNull(),
  config: jsonb('config'),
});

export const organizationUsers = pgTable(
  'organization_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    role: text('role').notNull(),
    status: text('status').notNull(),
    object: text('object').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull(),
    modified: timestamp('modified', { withTimezone: true, mode: 'string' }).notNull(),
    createdBy: uuid('created_by').notNull(),
    modifiedBy: uuid('modified_by').notNull(),
    profile: jsonb('profile'),
    config: jsonb('config'),
    ext: jsonb('ext'),
  },
  (table) => [unique('organization_users_user_organization_key').on(table.userId, table.organizationId)]
);

export const applications = pgTable('applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  status: text('status').notNull(),
  object: text('object'),
  created: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  modified: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdBy: uuid('created_by').notNull(),
  modifiedBy: uuid('updated_by').notNull(),
  subdomain: text('subdomain'),
  systemUserId: uuid('system_user_id'),
  organizationId: uuid('organization_id'),
});

