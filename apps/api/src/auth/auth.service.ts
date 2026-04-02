import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Injectable()
export class AuthService {
  validateUser(payload: { sub: string; email: string; roles: string[]; tenantId: string }): AuthenticatedUser {
    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      tenantId: payload.tenantId,
    };
  }
}
