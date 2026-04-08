/**
 * Local schema types – replaces @morezero/schemas/users for auth-server.
 * Minimal User and NewUser types used by repositories and routes.
 */

export interface UserConfig {
  firstName?: string;
  lastName?: string;
  isSystemUser?: boolean;
  [key: string]: unknown;
}

export interface NewUser {
  name?: string;
  email?: string;
  status?: string;
  object?: string;
  config?: UserConfig | Record<string, unknown>;
  createdBy?: string;
  /** Extended data */
  ext?: unknown;
}

export interface User extends NewUser {
  id: string;
  name: string;
  email: string;
  status: string;
  object?: string;
  createdBy?: string;
  updatedBy?: string;
  config?: UserConfig | Record<string, unknown>;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
