import { Module, Scope } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import crunchworkConfig from './config/crunchwork.config';
import authConfig from './config/auth.config';
import more0Config from './config/more0.config';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { TenantModule } from './tenant/tenant.module';
import { CrunchworkModule } from './crunchwork/crunchwork.module';
import { DatabaseModule } from './database/database.module';
import { More0Module } from './more0/more0.module';
import { ExternalModule } from './modules/external/external.module';
import { ExternalToolsModule } from './modules/external/tools/external-tools.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { MessagesModule } from './modules/messages/messages.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { TenantInterceptor } from './tenant/tenant.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, crunchworkConfig, authConfig, more0Config],
      validate,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule.forRoot(),
    TenantModule,
    CrunchworkModule,
    More0Module,
    ExternalModule,
    ExternalToolsModule,
    HealthModule,
    LookupsModule,
    ClaimsModule,
    JobsModule,
    QuotesModule,
    PurchaseOrdersModule,
    InvoicesModule,
    MessagesModule,
    TasksModule,
    AppointmentsModule,
    ReportsModule,
    AttachmentsModule,
    VendorsModule,
    ContactsModule,
    WebhooksModule,
    DashboardModule,
    ProvidersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor, scope: Scope.REQUEST },
  ],
})
export class AppModule {}
