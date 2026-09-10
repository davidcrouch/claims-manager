import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsersRepository } from '../database/repositories/users.repository';
import { setRequestActor } from '../common/request-actor.store';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly usersRepo: UsersRepository,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const headerTenantId = request.headers?.['x-tenant-id'] as string | undefined;
    const userTenant = user?.tenantId?.trim();
    const headerTenant = headerTenantId?.trim();
    const tenantId = userTenant || headerTenant;

    if (tenantId) {
      this.tenantContext.setTenant({ tenantId });
    }

    setRequestActor(await this.resolveActor(user));

    return next.handle();
  }

  private async resolveActor(
    user: AuthenticatedUser | undefined,
  ): Promise<{ userId: string; userName: string } | undefined> {
    const userId = user?.sub?.trim();
    if (!userId) return undefined;

    const email = user.email?.trim() || '';
    let userName = email || userId;
    try {
      let row = UUID_RE.test(userId)
        ? await this.usersRepo.findById({ id: userId })
        : null;
      if (!row && email) {
        row = await this.usersRepo.findByEmail({ email });
      }
      if (row?.name?.trim()) {
        userName = row.name.trim();
      } else if (row?.email?.trim()) {
        userName = row.email.trim();
      }
    } catch {
      // Keep JWT email/sub if the users table lookup fails.
    }

    return { userId, userName };
  }
}
