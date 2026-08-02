import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthServerClient } from './auth-server.client';

@Global()
@Module({
  providers: [
    {
      provide: 'AUTH_SERVER_URL',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('auth.authServerUrl') ??
        process.env.AUTH_SERVER_URL ??
        process.env.AUTH_ISSUER_URL ??
        '',
    },
    AuthServerClient,
  ],
  exports: [AuthServerClient],
})
export class AuthServerModule {}
