/**
 * auth-server DB schema (Drizzle) – shared with claims-manager API.
 * The API app owns migrations; this file mirrors the canonical definitions
 * in apps/api/src/database/schema/index.ts for auth-related tables.
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
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email'),
    name: text('name'),
    status: text('status').notNull().default('active'),
    object: text('object').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    config: jsonb('config'),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_users_email').on(t.email),
  ],
);

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



