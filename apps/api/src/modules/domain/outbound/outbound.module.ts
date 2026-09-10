import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { CrunchworkModule } from '../../../crunchwork/crunchwork.module';
import { AttachmentsModule } from '../../attachments/attachments.module';
import { OutboundSyncService } from './outbound-sync.service';
import { OutboundWorkerService } from './outbound-worker.service';
import { CrunchworkOutboundAdapter } from './adapters/crunchwork-outbound.adapter';

@Module({
  imports: [CrunchworkModule, forwardRef(() => AttachmentsModule)],
  providers: [
    OutboundSyncService,
    OutboundWorkerService,
    CrunchworkOutboundAdapter,
  ],
  exports: [OutboundSyncService, CrunchworkOutboundAdapter],
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
