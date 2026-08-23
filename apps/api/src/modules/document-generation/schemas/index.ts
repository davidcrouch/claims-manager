import type { ZodType } from 'zod';
import type { DocumentType } from '../types/document-types';

import { QuoteSourceSchema } from './source/quote.source';
import { InvoiceSourceSchema } from './source/invoice.source';
import { PurchaseOrderSourceSchema } from './source/purchase-order.source';
import { WorkOrderSourceSchema } from './source/work-order.source';
import { ProposalSourceSchema } from './source/proposal.source';
import { ReportSourceSchema } from './source/report.source';
import { BillSourceSchema } from './source/bill.source';
import { RfqSourceSchema } from './source/rfq.source';
import { JobSourceSchema } from './source/job.source';
import { ClaimSourceSchema } from './source/claim.source';
import { ContactSourceSchema } from './source/contact.source';
import { TaskSourceSchema } from './source/task.source';
import { AppointmentSourceSchema } from './source/appointment.source';
import { MessageSourceSchema } from './source/message.source';
import { JournalSourceSchema } from './source/journal.source';
import { VendorSourceSchema } from './source/vendor.source';
import { AssessmentSourceSchema } from './source/assessment.source';
import { DocumentSourceSchema } from './source/document.source';
import { JobsListSourceSchema } from './source/jobs-list.source';
import { QuotesListSourceSchema } from './source/quotes-list.source';
import { InvoicesListSourceSchema } from './source/invoices-list.source';
import { BillsListSourceSchema } from './source/bills-list.source';
import { WorkOrdersListSourceSchema } from './source/work-orders-list.source';
import { PurchaseOrdersListSourceSchema } from './source/purchase-orders-list.source';
import { ProposalsListSourceSchema } from './source/proposals-list.source';
import { RfqsListSourceSchema } from './source/rfqs-list.source';
import { ReportsListSourceSchema } from './source/reports-list.source';
import { ClaimsListSourceSchema } from './source/claims-list.source';
import { ContactsListSourceSchema } from './source/contacts-list.source';
import { TasksListSourceSchema } from './source/tasks-list.source';
import { AppointmentsListSourceSchema } from './source/appointments-list.source';
import { MessagesListSourceSchema } from './source/messages-list.source';
import { JournalsListSourceSchema } from './source/journals-list.source';
import { VendorsListSourceSchema } from './source/vendors-list.source';
import { AssessmentsListSourceSchema } from './source/assessments-list.source';
import { DocumentsListSourceSchema } from './source/documents-list.source';
import { ScheduleListSourceSchema } from './source/schedule-list.source';

export const SOURCE_SCHEMAS: Record<DocumentType, ZodType> = {
  quote: QuoteSourceSchema,
  invoice: InvoiceSourceSchema,
  purchase_order: PurchaseOrderSourceSchema,
  work_order: WorkOrderSourceSchema,
  proposal: ProposalSourceSchema,
  report: ReportSourceSchema,
  bill: BillSourceSchema,
  rfq: RfqSourceSchema,
  job_details: JobSourceSchema,
  scope_of_work: QuoteSourceSchema,
  claim: ClaimSourceSchema,
  contact: ContactSourceSchema,
  task: TaskSourceSchema,
  appointment: AppointmentSourceSchema,
  message: MessageSourceSchema,
  journal: JournalSourceSchema,
  vendor: VendorSourceSchema,
  assessment: AssessmentSourceSchema,
  document: DocumentSourceSchema,
  jobs_list: JobsListSourceSchema,
  quotes_list: QuotesListSourceSchema,
  invoices_list: InvoicesListSourceSchema,
  bills_list: BillsListSourceSchema,
  work_orders_list: WorkOrdersListSourceSchema,
  purchase_orders_list: PurchaseOrdersListSourceSchema,
  proposals_list: ProposalsListSourceSchema,
  rfqs_list: RfqsListSourceSchema,
  reports_list: ReportsListSourceSchema,
  claims_list: ClaimsListSourceSchema,
  contacts_list: ContactsListSourceSchema,
  tasks_list: TasksListSourceSchema,
  appointments_list: AppointmentsListSourceSchema,
  messages_list: MessagesListSourceSchema,
  journals_list: JournalsListSourceSchema,
  vendors_list: VendorsListSourceSchema,
  assessments_list: AssessmentsListSourceSchema,
  documents_list: DocumentsListSourceSchema,
  schedule_list: ScheduleListSourceSchema,
};

export { ListEnvelopeSchema, GroupItemSchema, GroupSchema } from './source/_shared';

export { QuoteSourceSchema } from './source/quote.source';
export { InvoiceSourceSchema } from './source/invoice.source';
export { PurchaseOrderSourceSchema } from './source/purchase-order.source';
export { WorkOrderSourceSchema } from './source/work-order.source';
export { ProposalSourceSchema } from './source/proposal.source';
export { ReportSourceSchema } from './source/report.source';
export { BillSourceSchema } from './source/bill.source';
export { RfqSourceSchema } from './source/rfq.source';
export { JobSourceSchema } from './source/job.source';
export { ClaimSourceSchema } from './source/claim.source';
export { ContactSourceSchema } from './source/contact.source';
export { TaskSourceSchema } from './source/task.source';
export { AppointmentSourceSchema } from './source/appointment.source';
export { MessageSourceSchema } from './source/message.source';
export { JournalSourceSchema } from './source/journal.source';
export { VendorSourceSchema } from './source/vendor.source';
export { AssessmentSourceSchema } from './source/assessment.source';
export { DocumentSourceSchema } from './source/document.source';
export { JobsListSourceSchema } from './source/jobs-list.source';
export { QuotesListSourceSchema } from './source/quotes-list.source';
export { InvoicesListSourceSchema } from './source/invoices-list.source';
export { BillsListSourceSchema } from './source/bills-list.source';
export { WorkOrdersListSourceSchema } from './source/work-orders-list.source';
export { PurchaseOrdersListSourceSchema } from './source/purchase-orders-list.source';
export { ProposalsListSourceSchema } from './source/proposals-list.source';
export { RfqsListSourceSchema } from './source/rfqs-list.source';
export { ReportsListSourceSchema } from './source/reports-list.source';
export { ClaimsListSourceSchema } from './source/claims-list.source';
export { ContactsListSourceSchema } from './source/contacts-list.source';
export { TasksListSourceSchema } from './source/tasks-list.source';
export { AppointmentsListSourceSchema } from './source/appointments-list.source';
export { MessagesListSourceSchema } from './source/messages-list.source';
export { JournalsListSourceSchema } from './source/journals-list.source';
export { VendorsListSourceSchema } from './source/vendors-list.source';
export { AssessmentsListSourceSchema } from './source/assessments-list.source';
export { DocumentsListSourceSchema } from './source/documents-list.source';
export { ScheduleListSourceSchema } from './source/schedule-list.source';
