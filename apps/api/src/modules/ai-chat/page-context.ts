import { Logger } from '@nestjs/common';
import type { PageContext } from './ai-chat.types';
import type { TemplateData } from '../document-generation/types/document-types';

const LOG_PREFIX = 'PageContextResolver';
const logger = new Logger('PageContextResolver');

export interface ResolvedPageContext {
  contextBlock: string;
  entityCategory: string | null;
}

interface PageEntityMapping {
  category: string;
  label: string;
  /** Document type key for the detail mapper (used by DocumentGenerationService) */
  detailDocType?: string;
  /** Document type key for the list mapper (used by DocumentGenerationService) */
  listDocType?: string;
  listHints: string[];
  detailHints: string[];
}

const ENTITY_MAP: Record<string, PageEntityMapping> = {
  assessment: {
    category: 'assessments',
    label: 'Assessments',
    detailDocType: 'assessment',
    listDocType: 'assessments_list',
    listHints: [
      'Create a new assessment for this job',
      'Open and edit existing assessments',
      'Search or filter the assessment list',
    ],
    detailHints: [
      'Edit assessment sections (building, hazards, etc.)',
      'Validate or publish this assessment',
      'Review section completion status',
    ],
  },
  job: {
    category: 'jobs',
    label: 'Jobs',
    detailDocType: 'job_details',
    listDocType: 'jobs_list',
    listHints: ['Search or filter jobs', 'View job details'],
    detailHints: [
      'View job overview and parties',
      'Navigate to related entities (assessments, quotes, work orders)',
      'Update job details or status',
    ],
  },
  claim: {
    category: 'claims',
    label: 'Claims',
    detailDocType: 'claim',
    listDocType: 'claims_list',
    listHints: ['Search or filter claims', 'View claim details'],
    detailHints: ['View claim overview', 'Navigate to related jobs'],
  },
  quote: {
    category: 'estimates',
    label: 'Estimates',
    detailDocType: 'quote',
    listDocType: 'quotes_list',
    listHints: [
      'Create a new estimate for this job',
      'Review existing estimates',
      'Filter or search estimates',
    ],
    detailHints: [
      'Edit estimate line items',
      'Submit or approve this estimate',
      'Generate estimate documents',
    ],
  },
  task: {
    category: 'tasks',
    label: 'Tasks',
    detailDocType: 'task',
    listDocType: 'tasks_list',
    listHints: [
      'Create a new task',
      'Filter tasks by status or assignee',
      'View task details',
    ],
    detailHints: [
      'Update task status or assignee',
      'Add notes or comments',
      'Mark task complete',
    ],
  },
  contact: {
    category: 'contacts',
    label: 'Contacts',
    detailDocType: 'contact',
    listDocType: 'contacts_list',
    listHints: [
      'Create a new contact',
      'Search contacts',
      'Filter by role or type',
    ],
    detailHints: ['Edit contact details', 'View related entities'],
  },
  document: {
    category: 'documents',
    label: 'Documents',
    detailDocType: 'document',
    listDocType: 'documents_list',
    listHints: [
      'Upload or generate documents',
      'Search documents',
      'Filter by type',
    ],
    detailHints: ['Preview document', 'Download or share'],
  },
  schedule: {
    category: 'appointments',
    label: 'Schedule',
    listDocType: 'schedule_list',
    listHints: [
      'Schedule a new appointment',
      'View upcoming appointments on the calendar',
      'Filter schedule by job',
    ],
    detailHints: ['Reschedule', 'Cancel appointment'],
  },
  invoice: {
    category: 'invoices',
    label: 'Invoices',
    detailDocType: 'invoice',
    listDocType: 'invoices_list',
    listHints: ['Create a new invoice', 'Search invoices', 'Filter by status'],
    detailHints: ['Edit invoice line items', 'Submit or approve'],
  },
  journal: {
    category: 'journals',
    label: 'Journals',
    detailDocType: 'journal',
    listDocType: 'journals_list',
    listHints: ['Create a journal entry', 'Search journals'],
    detailHints: ['Edit journal entry', 'View attachments'],
  },
  rfq: {
    category: 'rfqs',
    label: 'Request for Quotations',
    detailDocType: 'rfq',
    listDocType: 'rfqs_list',
    listHints: ['Create a new RFQ', 'Search RFQs', 'Filter by status'],
    detailHints: ['Edit RFQ scope', 'Send to vendors'],
  },
  proposal: {
    category: 'proposals',
    label: 'Proposals',
    detailDocType: 'proposal',
    listDocType: 'proposals_list',
    listHints: ['Review proposals', 'Filter by status'],
    detailHints: ['Accept or reject proposal', 'Compare with other proposals'],
  },
  'purchase-order': {
    category: 'purchase-orders',
    label: 'Purchase Orders',
    detailDocType: 'purchase_order',
    listDocType: 'purchase_orders_list',
    listHints: ['Create a new PO', 'Search purchase orders'],
    detailHints: ['Edit PO details', 'Approve or issue'],
  },
  bill: {
    category: 'bills',
    label: 'Bills',
    detailDocType: 'bill',
    listDocType: 'bills_list',
    listHints: ['Record a new bill', 'Search bills', 'Filter by status'],
    detailHints: ['Edit bill details', 'Approve for payment'],
  },
  'work-order': {
    category: 'work-orders',
    label: 'Work Orders',
    detailDocType: 'work_order',
    listDocType: 'work_orders_list',
    listHints: [
      'Create a new work order',
      'Search work orders',
      'Filter by status',
    ],
    detailHints: ['Edit work order scope', 'Assign vendor', 'Close work order'],
  },
  message: {
    category: 'messages',
    label: 'Messages',
    detailDocType: 'message',
    listDocType: 'messages_list',
    listHints: ['Compose a new message', 'Search messages'],
    detailHints: ['Reply to message', 'Forward'],
  },
  appointment: {
    category: 'appointments',
    label: 'Appointments',
    detailDocType: 'appointment',
    listDocType: 'appointments_list',
    listHints: ['Schedule a new appointment', 'View upcoming appointments'],
    detailHints: ['Reschedule', 'Cancel appointment'],
  },
};

/**
 * Fetches canonical page data using document generation mappers.
 * Pass the document type (e.g. 'job_details', 'assessment') and entity ID.
 */
export type PageDataFetcher = (
  documentType: string,
  entityId: string,
) => Promise<TemplateData | null>;

/**
 * Returns the document type key to use for fetching page data,
 * based on entity type and whether the user is on a detail vs list page.
 */
export function resolveDocumentType(
  mapping: PageEntityMapping,
  isDetail: boolean,
): string | undefined {
  return isDetail ? mapping.detailDocType : mapping.listDocType;
}

const CONTEXT_SUMMARY_FIELDS: Record<string, string[]> = {
  job_details: ['job_name', 'job_reference', 'job_status', 'job_type', 'job_address', 'claim_reference'],
  assessment: ['assessment_name', 'status', 'job_name', 'job_reference', 'claim_recommendation'],
  claim: ['claim_number', 'claim_reference', 'status', 'date_of_loss', 'incident_description'],
  quote: ['quote_reference', 'status', 'job_name', 'total'],
  invoice: ['invoice_reference', 'status', 'job_name', 'total'],
  task: ['task_name', 'status', 'assignee', 'due_date'],
  contact: ['contact_name', 'email', 'phone', 'role'],
  document: ['file_name', 'mime_type', 'upload_status', 'related_record_type', 'file_size'],
};

function formatListSummary(data: TemplateData): string {
  const lines: string[] = [];
  if (data.total_count != null) {
    lines.push(`  Total count: ${String(data.total_count)}`);
  }
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length > 0) {
    lines.push('  Recent items:');
    for (const item of items.slice(0, 5)) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const label =
        row.name ??
        row.file_name ??
        row.assessment_name ??
        row.claim_number ??
        row.subject ??
        'item';
      const status = row.status ?? row.upload_status ?? '';
      lines.push(
        `    - ${String(label)}${status ? ` (${String(status)})` : ''}`,
      );
    }
  }
  return lines.join('\n');
}

function formatPageDataSummary(documentType: string, data: TemplateData): string {
  if (documentType.endsWith('_list') || Array.isArray(data.items)) {
    return formatListSummary(data);
  }

  const fields = CONTEXT_SUMMARY_FIELDS[documentType];
  if (!fields) {
    const keys = Object.keys(data).filter(
      (k) => data[k] && String(data[k]).trim() && k !== 'items',
    );
    const summary = keys
      .slice(0, 8)
      .map((k) => `  ${k}: ${String(data[k])}`)
      .join('\n');
    return summary;
  }

  const lines: string[] = [];
  for (const field of fields) {
    const value = data[field];
    if (value && String(value).trim()) {
      const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`  ${label}: ${String(value)}`);
    }
  }
  return lines.join('\n');
}

export async function resolvePageContextBlock(
  pageContext: PageContext | undefined,
  fetchPageData?: PageDataFetcher,
  options?: { tenantId?: string },
): Promise<ResolvedPageContext> {
  if (!pageContext) {
    return { contextBlock: '', entityCategory: null };
  }

  const lines: string[] = [];
  const mapping = pageContext.entityType
    ? ENTITY_MAP[pageContext.entityType]
    : undefined;
  const entityCategory: string | null = mapping?.category ?? null;
  const isDetail = !!pageContext.entityId;

  // Fetch job data if active job is present
  if (pageContext.jobId && fetchPageData) {
    try {
      const jobData = await fetchPageData('job_details', pageContext.jobId);
      if (jobData) {
        const jobLine = jobData.job_name || jobData.job_reference || pageContext.jobId;
        lines.push(`Active Job: "${jobLine}" (ID: ${pageContext.jobId})`);
        const meta: string[] = [];
        if (jobData.claim_reference) meta.push(`Claim: ${String(jobData.claim_reference)}`);
        if (jobData.job_status) meta.push(`Status: ${String(jobData.job_status)}`);
        if (jobData.job_type) meta.push(`Type: ${String(jobData.job_type)}`);
        if (meta.length > 0) lines.push(`  - ${meta.join(' | ')}`);
        if (jobData.job_address) lines.push(`  - Address: ${String(jobData.job_address)}`);
      }
    } catch (err) {
      logger.warn(
        `[${LOG_PREFIX}.resolvePageContextBlock] failed to load job ${pageContext.jobId}: ${String(err)}`,
      );
    }
  }

  // Fetch entity detail data if on a detail page
  if (isDetail && pageContext.entityId && mapping && fetchPageData) {
    const docType = resolveDocumentType(mapping, true);
    if (docType) {
      try {
        const entityData = await fetchPageData(docType, pageContext.entityId);
        if (entityData) {
          const summary = formatPageDataSummary(docType, entityData);
          if (summary) {
            lines.push(`\nCurrent Entity (${mapping.label} Detail):`);
            lines.push(summary);
          }
        }
      } catch (err) {
        logger.debug(
          `[${LOG_PREFIX}.resolvePageContextBlock] entity data fetch failed for ${docType}/${pageContext.entityId}: ${String(err)}`,
        );
      }
    }
  }

  // Fetch list summary if on a list page
  if (!isDetail && mapping?.listDocType && fetchPageData && options?.tenantId) {
    try {
      const listData = await fetchPageData(mapping.listDocType, options.tenantId);
      if (listData) {
        const summary = formatPageDataSummary(mapping.listDocType, listData);
        if (summary) {
          lines.push(`\nPage Data (${mapping.label} List):`);
          lines.push(summary);
        }
      }
    } catch (err) {
      logger.debug(
        `[${LOG_PREFIX}.resolvePageContextBlock] list data fetch failed for ${mapping.listDocType}: ${String(err)}`,
      );
    }
  }

  const pageLabel =
    pageContext.pageLabel ?? mapping?.label ?? pageContext.pathname;
  const scope = pageContext.jobId ? ' (filtered to active job)' : '';
  lines.push(`\nCurrent Page: ${pageLabel}${scope}`);

  if (mapping) {
    const hints = isDetail ? mapping.detailHints : mapping.listHints;
    if (hints.length > 0) {
      lines.push('\nYou can help the user:');
      for (const hint of hints) {
        lines.push(`- ${hint}`);
      }
    }
  }

  const contextBlock =
    lines.length > 0 ? `\n\n## Current Context\n${lines.join('\n')}` : '';

  return { contextBlock, entityCategory };
}
