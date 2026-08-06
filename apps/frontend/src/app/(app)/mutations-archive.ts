'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';

export type ArchiveEntityType =
  | 'job'
  | 'claim'
  | 'quote'
  | 'invoice'
  | 'bill'
  | 'work_order'
  | 'purchase_order'
  | 'rfq'
  | 'proposal'
  | 'report'
  | 'journal'
  | 'vendor'
  | 'assessment';

const STATUS_DOMAIN: Partial<Record<ArchiveEntityType, string>> = {
  job: 'job_status',
  claim: 'claim_status',
  quote: 'quote_status',
  invoice: 'invoice_status',
  bill: 'bill_status',
  work_order: 'wo_status',
  purchase_order: 'po_status',
  rfq: 'rfq_status',
  proposal: 'proposal_status',
  report: 'report_status',
};

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

async function resolveArchivedStatusLookupId(
  api: NonNullable<Awaited<ReturnType<typeof getApi>>>,
  domain: string,
): Promise<string> {
  const ensured = await api.ensureLookup({ domain, name: 'Archived' });
  return ensured.id;
}

export async function archiveEntityAction(
  entityType: ArchiveEntityType,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    if (entityType === 'journal') {
      await api.updateJournal(id, { status: 'archived' });
      return { success: true };
    }

    if (entityType === 'assessment') {
      await api.updateAssessment(id, { status: 'archived' });
      return { success: true };
    }

    if (entityType === 'vendor') {
      return {
        success: false,
        error: 'Vendors cannot be archived from this screen.',
      };
    }

    const domain = STATUS_DOMAIN[entityType];
    if (!domain) {
      return { success: false, error: `Unsupported entity type: ${entityType}` };
    }

    const statusLookupId = await resolveArchivedStatusLookupId(api, domain);
    const body = { statusLookupId };

    switch (entityType) {
      case 'job':
        await api.updateJob(id, body);
        break;
      case 'claim':
        await api.updateClaim(id, body);
        break;
      case 'quote':
        await api.updateQuote(id, body);
        break;
      case 'invoice':
        await api.updateInvoice(id, body);
        break;
      case 'bill':
        await api.updateBill(id, body);
        break;
      case 'work_order':
        await api.updateWorkOrder(id, body);
        break;
      case 'purchase_order':
        await api.updatePurchaseOrder(id, body);
        break;
      case 'rfq':
        await api.updateRfq(id, body);
        break;
      case 'proposal':
        await api.updateProposal(id, body);
        break;
      case 'report':
        await api.updateReport(id, body);
        break;
      default:
        return { success: false, error: `Unsupported entity type: ${entityType}` };
    }

    return { success: true };
  } catch (err) {
    console.error(
      `[frontend:mutations-archive.archiveEntityAction] ${entityType}/${id}`,
      err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to archive',
    };
  }
}
