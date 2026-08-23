import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, aliasedTable } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { readContactTypeLookupIds } from '../../../common/contact-types';
import {
  assessments,
  appointments,
  bills,
  claimContacts,
  claims,
  contacts,
  invoices,
  jobContacts,
  jobs,
  lookupValues,
  organizations,
  proposals,
  purchaseOrders,
  quotes,
  reports,
  rfqs,
  tasks,
  vendors,
  workOrders,
} from '../../../database/schema';
import type { DocumentType } from '../types/document-types';
import {
  getContextDefinition,
  getDefaultEnabledSlugs,
} from './context-definitions';
import type { DataEnvelope, RelatedEntityDef } from './types';

type Row = Record<string, unknown>;

@Injectable()
export class ContextResolver {
  private readonly logger = new Logger('ContextResolver');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async resolve(params: {
    tenantId: string;
    documentType: DocumentType;
    entityId: string;
    enabledSlugs?: string[] | null;
  }): Promise<DataEnvelope | null> {
    const logPrefix = 'ContextResolver.resolve';
    const definition = getContextDefinition(params.documentType);
    if (!definition) {
      this.logger.debug(`${logPrefix} — no definition for type=${params.documentType}`);
      return null;
    }

    const enabled =
      params.enabledSlugs && params.enabledSlugs.length > 0
        ? params.enabledSlugs
        : getDefaultEnabledSlugs(params.documentType);

    const primary = await this.fetchByType(
      params.tenantId,
      definition.primaryEntity.entityType,
      params.entityId,
    );
    if (!primary) {
      throw new NotFoundException(
        `${definition.primaryEntity.entityType} not found for data context`,
      );
    }

    const envelope: DataEnvelope = {
      organization: await this.fetchOrganization(params.tenantId),
      [this.envelopeKey(definition.primaryEntity.entityType)]: this.pickFields(
        primary,
        definition.primaryEntity.fields.map((f) => f.key),
      ),
    };

    for (const related of definition.relatedEntities) {
      if (!enabled.includes(related.slug)) continue;
      try {
        const value = await this.resolveRelated(params.tenantId, primary, related);
        envelope[related.slug] = value;
      } catch (err) {
        this.logger.warn(
          `${logPrefix} — failed slug=${related.slug}: ${
            err instanceof Error ? err.message : err
          }`,
        );
        envelope[related.slug] = related.cardinality === 'many' ? [] : null;
      }
    }

    this.logger.debug(
      `${logPrefix} — type=${params.documentType} entityId=${params.entityId} keys=${Object.keys(envelope).join(',')}`,
    );
    return envelope;
  }

  private async resolveRelated(
    tenantId: string,
    primary: Row,
    related: RelatedEntityDef,
  ): Promise<unknown> {
    if (related.cardinality === 'one') {
      const id = await this.walkToId(tenantId, primary, related.traversalPath);
      if (!id) return null;
      const row = await this.fetchByType(tenantId, related.entityType, id);
      if (!row) return null;
      return this.pickFields(
        row,
        related.fields.map((f) => f.key),
      );
    }

    // many
    const parentId = await this.resolveManyParentId(tenantId, primary, related);
    if (!parentId) return [];

    if (related.viaJoin === 'job_contacts' || related.viaJoin === 'claim_contacts') {
      const rows = await this.fetchContactsViaJoin(
        tenantId,
        related.viaJoin,
        parentId,
      );
      const enriched = await this.enrichContacts(tenantId, rows);
      return enriched.map((row) =>
        this.pickFields(
          row,
          related.fields.map((f) => f.key),
        ),
      );
    }

    const parentFk = related.parentFk ?? related.traversalPath[related.traversalPath.length - 1];
    if (!parentFk) return [];

    const rows = await this.fetchManyByFk(
      tenantId,
      related.entityType,
      parentFk,
      parentId,
    );
    return rows.map((row) =>
      this.pickFields(
        row,
        related.fields.map((f) => f.key),
      ),
    );
  }

  /**
   * For many relations: empty traversalPath → primary.id;
   * otherwise walk path and use the final FK value as the filter id.
   */
  private async resolveManyParentId(
    tenantId: string,
    primary: Row,
    related: RelatedEntityDef,
  ): Promise<string | null> {
    if (related.traversalPath.length === 0) {
      return typeof primary.id === 'string' ? primary.id : null;
    }
    return this.walkToId(tenantId, primary, related.traversalPath);
  }

  /**
   * Walk FK fields. For a path [a, b]: read primary[a], fetch that entity, read entity[b], return that id.
   * For a single-element path [a]: return primary[a] as the id (without fetching).
   */
  private async walkToId(
    tenantId: string,
    start: Row,
    path: string[],
  ): Promise<string | null> {
    if (path.length === 0) {
      return typeof start.id === 'string' ? start.id : null;
    }

    let current: Row = start;
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      const nextId = current[key];
      if (typeof nextId !== 'string' || !nextId) return null;

      const isLast = i === path.length - 1;
      if (isLast) return nextId;

      const entityType = this.inferEntityTypeFromFk(key);
      if (!entityType) return null;
      const next = await this.fetchByType(tenantId, entityType, nextId);
      if (!next) return null;
      current = next;
    }
    return null;
  }

  private inferEntityTypeFromFk(fk: string): string | null {
    const map: Record<string, string> = {
      jobId: 'Job',
      claimId: 'Claim',
      quoteId: 'Quote',
      purchaseOrderId: 'PurchaseOrder',
      workOrderId: 'WorkOrder',
      invoiceId: 'Invoice',
      vendorId: 'Vendor',
      billId: 'Bill',
      proposalId: 'Proposal',
      rfqId: 'RFQ',
      assessmentId: 'Assessment',
      reportId: 'Report',
    };
    return map[fk] ?? null;
  }

  private async fetchByType(
    tenantId: string,
    entityType: string,
    id: string,
  ): Promise<Row | null> {
    switch (entityType) {
      case 'Assessment':
        return this.fetchOne(assessments, tenantId, id, true);
      case 'Job':
        return this.fetchJob(tenantId, id);
      case 'Claim':
        return this.fetchOne(claims, tenantId, id, false);
      case 'Quote':
        return this.fetchOne(quotes, tenantId, id, false);
      case 'Invoice':
        return this.fetchOne(invoices, tenantId, id, false);
      case 'PurchaseOrder':
        return this.fetchOne(purchaseOrders, tenantId, id, false);
      case 'WorkOrder':
        return this.fetchOne(workOrders, tenantId, id, false);
      case 'Bill':
        return this.fetchOne(bills, tenantId, id, false);
      case 'Proposal':
        return this.fetchOne(proposals, tenantId, id, false);
      case 'RFQ':
        return this.fetchOne(rfqs, tenantId, id, false);
      case 'Report':
        return this.fetchOne(reports, tenantId, id, false);
      case 'Vendor':
        return this.fetchOne(vendors, tenantId, id, false);
      case 'Task':
        return this.fetchOne(tasks, tenantId, id, true);
      case 'Appointment':
        return this.fetchOne(appointments, tenantId, id, false);
      case 'Contact':
        return this.fetchOne(contacts, tenantId, id, true);
      default:
        this.logger.warn(`ContextResolver.fetchByType — unknown type=${entityType}`);
        return null;
    }
  }

  private async fetchOrganization(tenantId: string): Promise<Row> {
    const [org] = await this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);
    return { id: org?.id ?? tenantId, name: org?.name ?? '' };
  }

  private async fetchJob(tenantId: string, id: string): Promise<Row | null> {
    const statusLookup = aliasedTable(lookupValues, 'job_status_lookup');
    const typeLookup = aliasedTable(lookupValues, 'job_type_lookup');
    const [row] = await this.db
      .select({
        job: jobs,
        statusName: statusLookup.name,
        jobTypeName: typeLookup.name,
      })
      .from(jobs)
      .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
      .leftJoin(typeLookup, eq(jobs.jobTypeLookupId, typeLookup.id))
      .where(
        and(eq(jobs.id, id), eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)),
      )
      .limit(1);
    if (!row) return null;
    return {
      ...(row.job as unknown as Row),
      statusName: row.statusName ?? '',
      jobTypeName: row.jobTypeName ?? '',
    };
  }

  private async fetchOne(
    table: any,
    tenantId: string,
    id: string,
    softDelete: boolean,
  ): Promise<Row | null> {
    const conditions = [eq(table.id, id), eq(table.tenantId, tenantId)];
    if (softDelete && table.deletedAt) {
      conditions.push(isNull(table.deletedAt));
    }
    const [row] = await this.db
      .select()
      .from(table)
      .where(and(...conditions))
      .limit(1);
    return (row as Row) ?? null;
  }

  private async fetchManyByFk(
    tenantId: string,
    entityType: string,
    parentFk: string,
    parentId: string,
  ): Promise<Row[]> {
    const table = this.tableFor(entityType);
    if (!table) return [];
    const fkCol = table[parentFk];
    if (!fkCol) {
      this.logger.warn(
        `ContextResolver.fetchManyByFk — missing column ${parentFk} on ${entityType}`,
      );
      return [];
    }
    const conditions = [eq(table.tenantId, tenantId), eq(fkCol, parentId)];
    if (table.deletedAt) {
      conditions.push(isNull(table.deletedAt));
    }
    const rows = await this.db
      .select()
      .from(table)
      .where(and(...conditions));
    return rows as Row[];
  }

  private async fetchContactsViaJoin(
    tenantId: string,
    via: 'job_contacts' | 'claim_contacts',
    parentId: string,
  ): Promise<Row[]> {
    if (via === 'job_contacts') {
      const rows = await this.db
        .select({ contact: contacts })
        .from(jobContacts)
        .innerJoin(contacts, eq(jobContacts.contactId, contacts.id))
        .where(
          and(eq(jobContacts.tenantId, tenantId), eq(jobContacts.jobId, parentId)),
        );
      return rows.map((r) => r.contact as unknown as Row);
    }

    const rows = await this.db
      .select({ contact: contacts })
      .from(claimContacts)
      .innerJoin(contacts, eq(claimContacts.contactId, contacts.id))
      .where(
        and(eq(claimContacts.tenantId, tenantId), eq(claimContacts.claimId, parentId)),
      );
    return rows.map((r) => r.contact as unknown as Row);
  }

  private async enrichContacts(tenantId: string, rows: Row[]): Promise<Row[]> {
    if (rows.length === 0) return [];

    const allTypeIds = [
      ...new Set(
        rows.flatMap((contact) =>
          readContactTypeLookupIds({
            typeLookupId: contact.typeLookupId as string | null | undefined,
            contactPayload: contact.contactPayload,
          }),
        ),
      ),
    ];

    const lookupNames = new Map<string, string>();
    if (allTypeIds.length > 0) {
      const lookups = await this.db
        .select({ id: lookupValues.id, name: lookupValues.name })
        .from(lookupValues)
        .where(and(eq(lookupValues.tenantId, tenantId), inArray(lookupValues.id, allTypeIds)));
      for (const lookup of lookups) {
        lookupNames.set(lookup.id, lookup.name ?? '');
      }
    }

    return rows.map((contact) => {
      const typeIds = readContactTypeLookupIds({
        typeLookupId: contact.typeLookupId as string | null | undefined,
        contactPayload: contact.contactPayload,
      });
      const typeNames = typeIds
        .map((id) => lookupNames.get(id) ?? '')
        .filter((name) => name.length > 0);
      const normalized = typeNames.map((name) => name.toLowerCase());
      const isInsured = normalized.includes('insured');
      const isTenant = normalized.some(
        (name) => name === 'tenant' || name === 'occupant',
      );

      return {
        ...contact,
        typeName: typeNames[0] ?? '',
        typeNames,
        isInsured,
        isTenant,
      };
    });
  }

  private tableFor(entityType: string): any | null {
    const map: Record<string, any> = {
      Assessment: assessments,
      Job: jobs,
      Claim: claims,
      Quote: quotes,
      Invoice: invoices,
      PurchaseOrder: purchaseOrders,
      WorkOrder: workOrders,
      Bill: bills,
      Proposal: proposals,
      RFQ: rfqs,
      Report: reports,
      Vendor: vendors,
      Task: tasks,
      Appointment: appointments,
      Contact: contacts,
    };
    return map[entityType] ?? null;
  }

  private envelopeKey(entityType: string): string {
    return entityType
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .toLowerCase();
  }

  /**
   * Return entity fields for templates. Excludes internal/system columns.
   * Catalog keys in definitions document the intended surface; runtime includes
   * the full sanitized row so newly added schema fields are available immediately.
   */
  private pickFields(row: Row, _keys: string[]): Row {
    const internal = new Set([
      'tenantId',
      'deletedAt',
      'apiPayload',
      'sourcePayload',
      'createdByUserId',
      'updatedByUserId',
    ]);
    const out: Row = {};
    for (const [key, value] of Object.entries(row)) {
      if (internal.has(key)) continue;
      out[key] = value;
    }
    return out;
  }
}
