/**
 * Local users service – wraps users repository. Replaces @morezero/database/users.
 */

import type { AccessContext } from '../../schemas/index.js';
import type { User, NewUser } from '../../schemas/index.js';
import { getDb } from '../client.js';
import { createUsersRepository } from '../repositories/users-repository.js';

export class UsersService {
  private repo = createUsersRepository(getDb, undefined);

  async getUser(context: AccessContext, id: string): Promise<User | null> {
    return this.repo.get(context, id);
  }

  async getByEmail(context: AccessContext, email: string): Promise<User | null> {
    return this.repo.getByEmail(context, email);
  }

  async createUser(context: AccessContext, data: NewUser): Promise<User> {
    return this.repo.create(context, data);
  }

  async list(context: AccessContext, options: { limit?: number; page?: number } = {}): Promise<{ data: User[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    return this.repo.list(context, { limit: options.limit ?? 20, page: options.page ?? 1 });
  }
}

let _instance: UsersService | null = null;

export function createUsersService(): UsersService {
  if (!_instance) _instance = new UsersService();
  return _instance;
}
