import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly configService: ConfigService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const headerTenantId = request.headers?.['x-tenant-id'] as string | undefined;
    const orgCode = user?.tenantId || headerTenantId;

    if (orgCode) {
      const crunchworkTenantId =
        this.configService.get<string>('crunchwork.vendorTenantId') || orgCode;
      this.tenantContext.setTenant({
        tenantId: orgCode,
        crunchworkTenantId,
      });
    }

    return next.handle();
  }
}
