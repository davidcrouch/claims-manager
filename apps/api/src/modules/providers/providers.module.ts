import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { ProvidersController } from './providers.controller';
import { ConnectionsController } from './connections.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [TenantModule],
  controllers: [ProvidersController, ConnectionsController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
