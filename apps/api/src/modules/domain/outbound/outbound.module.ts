import { Module, OnModuleInit } from '@nestjs/common';
import { CrunchworkModule } from '../../../crunchwork/crunchwork.module';
import { OutboundSyncService } from './outbound-sync.service';
import { OutboundWorkerService } from './outbound-worker.service';
import { CrunchworkOutboundAdapter } from './adapters/crunchwork-outbound.adapter';

@Module({
  imports: [CrunchworkModule],
  providers: [
    OutboundSyncService,
    OutboundWorkerService,
    CrunchworkOutboundAdapter,
  ],
  exports: [OutboundSyncService],
})
export class OutboundModule implements OnModuleInit {
  constructor(
    private readonly worker: OutboundWorkerService,
    private readonly crunchworkAdapter: CrunchworkOutboundAdapter,
  ) {}

  onModuleInit(): void {
    this.worker.registerAdapter('crunchwork', this.crunchworkAdapter);
  }
}
