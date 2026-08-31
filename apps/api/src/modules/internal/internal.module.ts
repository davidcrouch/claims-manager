import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalTokenGuard } from './internal-token.guard';
import { ContactsModule } from '../contacts/contacts.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [ContactsModule, WebhooksModule],
  controllers: [InternalController],
  providers: [InternalService, InternalTokenGuard],
  exports: [InternalService],
})
export class InternalModule {}
