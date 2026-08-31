import { Module, Scope } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import more0Config from './config/more0.config';
import webhookConfig from './config/webhook.config';
import s3Config from './config/s3.config';
import gcsConfig from './config/gcs.config';
import aiConfig from './config/ai.config';
import { validate } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { HomeModule } from './home/home.module';
import { TenantModule } from './tenant/tenant.module';
import { CrunchworkModule } from './crunchwork/crunchwork.module';
import { DatabaseModule } from './database/database.module';
import { More0Module } from './more0/more0.module';
import { ExternalModule } from './modules/external/external.module';
import { WebhookToolsModule } from './modules/webhook-tools/webhook-tools.module';
import { LookupsModule } from './modules/lookups/lookups.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
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
import { InternalModule } from './modules/internal/internal.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { BillsModule } from './modules/bills/bills.module';
import { RfqsModule } from './modules/rfqs/rfqs.module';
import { RfqRequestsModule } from './modules/rfq-requests/rfq-requests.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { FinanceModule } from './modules/finance/finance.module';
import { DomainModule } from './modules/domain/domain.module';
import { WorkflowModule } from './modules/domain/workflows/workflow.module';
import { OutboundModule } from './modules/domain/outbound/outbound.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { JournalsModule } from './modules/journals/journals.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentGenerationModule } from './modules/document-generation/document-generation.module';
import { FilesystemModule } from './modules/filesystem/filesystem.module';
import { PipelineModule } from './modules/pipelines/pipeline.module';
import { SystemAgentsModule } from './modules/system-agents/system-agents.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { PubSubModule } from './modules/pubsub/pubsub.module';
import { ProvisioningModule } from './modules/provisioning/provisioning.module';
import { McpIntegrationModule } from './modules/mcp-integration/mcp-integration.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AiChatModule } from './modules/ai-chat/ai-chat.module';
import { SkillsModule } from './modules/skills/skills.module';
import { CapabilityPacksModule } from './modules/capability-packs/capability-packs.module';
import { GuidesModule } from './modules/guides/guides.module';
import { AuthServerModule } from './modules/auth-server/auth-server.module';
import { UserManagementModule } from './modules/user-management/user-management.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { OutboundEventsModule } from './modules/outbound-events/outbound-events.module';
import { WorkflowSchedulerModule } from './modules/workflow-scheduler/workflow-scheduler.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { TenantInterceptor } from './tenant/tenant.interceptor';
import { AllExceptionsFilter, HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CommonModule } from './common/common.module';
import { S3Module } from './common/s3/s3.module';
import { GcsModule } from './common/gcs/gcs.module';
import { OfficeModule } from './common/office/office.module';

@Module({
  imports: [
    CommonModule,
    S3Module,
    GcsModule,
    OfficeModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        authConfig,
        more0Config,
        webhookConfig,
        s3Config,
        gcsConfig,
        aiConfig,
      ],
      validate,
      envFilePath: ['.env'],
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
    OutboundEventsModule,
    ExternalModule,
    WebhookToolsModule,
    HomeModule,
    HealthModule,
    LookupsModule,
    ClaimsModule,
    JobsModule,
    QuotesModule,
    PurchaseOrdersModule,
    WorkOrdersModule,
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
    InternalModule,
    WorkOrdersModule,
    RfqsModule,
    RfqRequestsModule,
    CommunicationsModule,
    ProposalsModule,
    BillsModule,
    FinanceModule,
    DomainModule,
    WorkflowModule,
    OutboundModule,
    CatalogModule,
    JournalsModule,
    AssessmentsModule,
    ScheduleModule,
    NotificationsModule,
    SystemAgentsModule,
    PipelineModule,
    FilesystemModule,
    DocumentGenerationModule,
    OrganisationsModule,
    PubSubModule,
    ProvisioningModule,
    McpIntegrationModule,
    AgentsModule,
    ConversationsModule,
    AiChatModule,
    SkillsModule,
    CapabilityPacksModule,
    GuidesModule,
    AuthServerModule,
    UserManagementModule,
    RbacModule,
    WorkflowSchedulerModule,
    ActivitiesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
      scope: Scope.REQUEST,
    },
  ],
})
export class AppModule {}
