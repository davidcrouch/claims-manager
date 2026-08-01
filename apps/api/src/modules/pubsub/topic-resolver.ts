import { PUBSUB_CONFIG, type PubSubTopicKey } from '../../config/pubsub.config';

const ENTITY_TO_TOPIC: Record<string, PubSubTopicKey> = {
  purchase_order: 'purchaseOrders',
  work_order: 'workOrders',
  organisation: 'organisations',
  invoice: 'invoices',
  bill: 'bills',
};

export function resolveTopicForEntity(entityType: string): string | null {
  const key = ENTITY_TO_TOPIC[entityType];
  if (!key) return null;
  return PUBSUB_CONFIG.topics[key];
}
