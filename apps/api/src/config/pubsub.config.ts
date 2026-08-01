const env = process.env.APP_ENV ?? 'dev';

export const PUBSUB_CONFIG = {
  projectId: process.env.GCP_PROJECT_ID ?? '',
  env,
  topics: {
    purchaseOrders: `claims.purchase-orders-${env}`,
    workOrders: `claims.work-orders-${env}`,
    organisations: `claims.organisations-${env}`,
    invoices: `claims.invoices-${env}`,
    bills: `claims.bills-${env}`,
  },
  subscriptions: {
    purchaseOrderEvents: `claims.purchase-orders-api-sub-${env}`,
    workOrderEvents: `claims.work-orders-api-sub-${env}`,
    organisationEvents: `claims.organisations-api-sub-${env}`,
  },
  dlq: {
    purchaseOrders: `claims.purchase-orders-api-sub-${env}-dlq`,
    workOrders: `claims.work-orders-api-sub-${env}-dlq`,
    organisations: `claims.organisations-api-sub-${env}-dlq`,
  },
} as const;

export type PubSubTopicKey = keyof typeof PUBSUB_CONFIG.topics;
