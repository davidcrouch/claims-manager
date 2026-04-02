/**
 * Local schemas – auth-server only needs AccessContext, User, and NewUser.
 * Replaces @morezero/schemas for this app.
 */

export type { AccessContext } from './common.js';
export type { User, NewUser, UserConfig } from './users.js';
