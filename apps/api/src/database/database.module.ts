import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from './drizzle.module';
import {
  ClaimsRepository,
  LookupsRepository,
  JobsRepository,
  ContactsRepository,
  VendorsRepository,
  QuotesRepository,
  InvoicesRepository,
  PurchaseOrdersRepository,
  TasksRepository,
  MessagesRepository,
  AppointmentsRepository,
  ReportsRepository,
  AttachmentsRepository,
  InboundWebhookEventsRepository,
  UsersRepository,
  IntegrationProvidersRepository,
  IntegrationConnectionsRepository,
  ExternalObjectsRepository,
  ExternalObjectVersionsRepository,
  ExternalLinksRepository,
  ExternalProcessingLogRepository,
  ExternalEventAttemptsRepository,
} from './repositories';

const repositories = [
  ClaimsRepository,
  LookupsRepository,
  JobsRepository,
  ContactsRepository,
  VendorsRepository,
  QuotesRepository,
  InvoicesRepository,
  PurchaseOrdersRepository,
  TasksRepository,
  MessagesRepository,
  AppointmentsRepository,
  ReportsRepository,
  AttachmentsRepository,
  InboundWebhookEventsRepository,
  UsersRepository,
  IntegrationProvidersRepository,
  IntegrationConnectionsRepository,
  ExternalObjectsRepository,
  ExternalObjectVersionsRepository,
  ExternalLinksRepository,
  ExternalProcessingLogRepository,
  ExternalEventAttemptsRepository,
];

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [...repositories],
  exports: [...repositories],
})
export class DatabaseModule {}
