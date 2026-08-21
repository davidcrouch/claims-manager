import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalTokenGuard } from './internal-token.guard';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [ContactsModule],
  controllers: [InternalController],
  providers: [InternalService, InternalTokenGuard],
  exports: [InternalService],
})
export class InternalModule {}
