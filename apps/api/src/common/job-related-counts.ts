export type JobRelatedCounts = {
  journals: number;
  assessments: number;
  quotes: number;
  workOrders: number;
  invoices: number;
  rfqs: number;
  proposals: number;
  purchaseOrders: number;
  bills: number;
  tasks: number;
  schedule: number;
  messages: number;
  appointments: number;
  contacts: number;
  documents: number;
};

export function jobRelatedCountValue(row: { count: number } | undefined): number {
  return Number(row?.count) || 0;
}
