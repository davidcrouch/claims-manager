import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { LookupsModule } from '../lookups/lookups.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [TenantModule, LookupsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
