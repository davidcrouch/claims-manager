import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const jwksUri = configService.get<string>('auth.jwksUri');
    const issuerUrl = configService.get<string>('auth.issuerUrl');
    if (!jwksUri || !issuerUrl) {
      throw new Error(
        '[JwtStrategy.constructor] AUTH_JWKS_URI and AUTH_ISSUER_URL are required for JWT validation',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: issuerUrl,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri,
      }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return {
      sub: payload.sub,
      email: payload.email ?? '',
      roles: payload.roles || [],
      tenantId: payload.organization_id ?? '',
    };
  }
}
