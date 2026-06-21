import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';

@Module({
  imports: [TenantModule],
  controllers: [JournalsController],
  providers: [JournalsService],
  exports: [JournalsService],
})
export class JournalsModule {}
