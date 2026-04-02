import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Provider } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthService } from './auth.service';

@Module({
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {
  static forRoot(): DynamicModule {
    const hasAuthConfig = !!(
      process.env.AUTH_JWKS_URI &&
      process.env.AUTH_ISSUER_URL
    );

    const providers: Provider[] = [
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      AuthService,
    ];

    if (hasAuthConfig) {
      providers.push(JwtStrategy);
    }

    return {
      module: AuthModule,
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      providers,
      exports: [AuthService],
    };
  }
}
