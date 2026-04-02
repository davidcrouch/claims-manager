/**
 * Local schema types – replaces @morezero/schemas/common for auth-server.
 * AccessContext is used for organization-scoped access control in DB and services.
 */

export interface AccessContext {
  /** The organization ID for organization-scoped isolation */
  organizationId: string;
  /** The user ID for private resource access control */
  userId?: string;
  /** Additional context that might be needed in the future */
  metadata?: Record<string, unknown>;
}
