import { Module, OnModuleInit } from '@nestjs/common';
import { PubSubClientService } from './pubsub-client.service';
import { PubSubPublisherService } from './pubsub-publisher.service';
import { PubSubSubscriberService } from './pubsub-subscriber.service';
import { PubSubPushController } from './pubsub-push.controller';
import { PurchaseOrderEventHandler } from './handlers/purchase-order-event.handler';
import { WorkOrderEventHandler } from './handlers/work-order-event.handler';
import { OrganisationEventHandler } from './handlers/organisation-event.handler';

@Module({
  controllers: [PubSubPushController],
  providers: [
    PubSubClientService,
    PubSubPublisherService,
    PubSubSubscriberService,
    PurchaseOrderEventHandler,
    WorkOrderEventHandler,
    OrganisationEventHandler,
  ],
  exports: [PubSubClientService, PubSubSubscriberService],
})
export class PubSubModule implements OnModuleInit {
  constructor(
    private readonly subscriber: PubSubSubscriberService,
    private readonly poHandler: PurchaseOrderEventHandler,
    private readonly woHandler: WorkOrderEventHandler,
    private readonly orgHandler: OrganisationEventHandler,
  ) {}

  onModuleInit() {
    this.subscriber.registerHandler(this.poHandler);
    this.subscriber.registerHandler(this.woHandler);
    this.subscriber.registerHandler(this.orgHandler);
  }
}
