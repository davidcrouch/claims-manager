import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [TenantModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentsModule {}
