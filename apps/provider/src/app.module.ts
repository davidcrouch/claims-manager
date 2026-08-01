import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import more0Config from './config/more0.config';
import webhookConfig from './config/webhook.config';
import { validate } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { More0Module } from './more0/more0.module';
import { HealthModule } from './health/health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, more0Config, webhookConfig],
      validate,
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    More0Module,
    HealthModule,
    WebhooksModule,
  ],
})
export class AppModule {}
