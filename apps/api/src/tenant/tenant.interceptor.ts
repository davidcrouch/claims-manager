import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

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

    return next.handle();
  }
}
