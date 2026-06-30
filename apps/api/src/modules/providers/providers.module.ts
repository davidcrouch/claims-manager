import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { ProvidersController } from './providers.controller';
import { ConnectionsController } from './connections.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [TenantModule, CrunchworkModule],
  controllers: [ProvidersController, ConnectionsController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
