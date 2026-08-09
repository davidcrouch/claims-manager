import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, ilike, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { organizations, purchaseOrders, quotes } from '../../../database/schema';

export interface GhostCandidate {
  organisationId: string;
  name: string;
  abn?: string | null;
  legalName?: string | null;
  primaryEmail?: string | null;
  emailDomain?: string | null;
  subscriptionStatus: string;
  matchType: 'exact_abn' | 'exact_email' | 'name_domain' | 'ambiguous';
}

export interface GhostOrganisation {
  id: string;
  name: string;
  slug: string;
  abn?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  primaryEmail?: string | null;
  emailDomain?: string | null;
  phone?: string | null;
  subscriptionStatus: string;
}

@Injectable()
export class GhostOrganisationService {
  private readonly logger = new Logger('GhostOrganisationService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async resolveOrCreate(params: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    primaryEmail?: string;
    emailDomain?: string;
    phone?: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ organisationId: string; created: boolean; isActive: boolean }> {
    const { tx } = params;

    // 1. ABN match
    if (params.abn) {
      const matches = await tx
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.abn, params.abn),
            inArray(organizations.subscriptionStatus, ['ghost', 'active', 'verified']),
          ),
        )
        .limit(5);

      if (matches.length > 0) {
        if (matches.length > 1) {
          this.logger.warn(
            `GhostOrganisationService.resolveOrCreate — multiple ABN matches for abn=${params.abn}`,
          );
        }
        const match = matches.find((m) => m.subscriptionStatus === 'ghost') ?? matches[0];
        return {
          organisationId: match.id,
          created: false,
          isActive: match.subscriptionStatus === 'active',
        };
      }
    }

    // 2. Primary email match
    if (params.primaryEmail) {
      const [match] = await tx
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.primaryEmail, params.primaryEmail),
            eq(organizations.subscriptionStatus, 'ghost'),
          ),
        )
        .limit(1);

      if (match) {
        return { organisationId: match.id, created: false, isActive: false };
      }
    }

    // 3. Legal name + email domain match
    if (params.legalName && params.emailDomain) {
      const [match] = await tx
        .select()
        .from(organizations)
        .where(
          and(
            ilike(organizations.legalName, params.legalName),
            eq(organizations.emailDomain, params.emailDomain),
            eq(organizations.subscriptionStatus, 'ghost'),
          ),
        )
        .limit(1);

      if (match) {
        return { organisationId: match.id, created: false, isActive: false };
      }
    }

    // 4. No match — create new ghost
    const displayName = params.tradingName || params.legalName || params.primaryEmail || 'Unknown';
    const slug = this.generateSlug(displayName);

    const [created] = await tx
      .insert(organizations)
      .values({
        name: displayName,
        slug,
        status: 'inactive',
        object: 'organization',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        createdBy: '00000000-0000-0000-0000-000000000000',
        modifiedBy: '00000000-0000-0000-0000-000000000000',
        orgCode: slug,
        subscriptionStatus: 'ghost',
        abn: params.abn ?? null,
        legalName: params.legalName ?? null,
        tradingName: params.tradingName ?? null,
        primaryEmail: params.primaryEmail ?? null,
        emailDomain: params.emailDomain ?? this.extractEmailDomain(params.primaryEmail),
        phone: params.phone ?? null,
      })
      .returning();

    this.logger.log(
      `GhostOrganisationService.resolveOrCreate — created ghost org id=${created.id} name=${displayName}`,
    );

    return { organisationId: created.id, created: true, isActive: false };
  }

  async findCandidates(params: {
    abn?: string;
    legalName?: string;
    primaryEmail?: string;
    emailDomain?: string;
  }): Promise<GhostCandidate[]> {
    const candidates: GhostCandidate[] = [];

    if (params.abn) {
      const matches = await this.db
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.abn, params.abn),
            inArray(organizations.subscriptionStatus, ['ghost', 'active', 'verified']),
          ),
        );
      for (const m of matches) {
        candidates.push({
          organisationId: m.id,
          name: m.name,
          abn: m.abn,
          legalName: m.legalName,
          primaryEmail: m.primaryEmail,
          emailDomain: m.emailDomain,
          subscriptionStatus: m.subscriptionStatus,
          matchType: 'exact_abn',
        });
      }
    }

    if (params.primaryEmail) {
      const matches = await this.db
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.primaryEmail, params.primaryEmail),
            eq(organizations.subscriptionStatus, 'ghost'),
          ),
        );
      for (const m of matches) {
        if (!candidates.find((c) => c.organisationId === m.id)) {
          candidates.push({
            organisationId: m.id,
            name: m.name,
            abn: m.abn,
            legalName: m.legalName,
            primaryEmail: m.primaryEmail,
            emailDomain: m.emailDomain,
            subscriptionStatus: m.subscriptionStatus,
            matchType: 'exact_email',
          });
        }
      }
    }

    if (params.legalName && params.emailDomain) {
      const matches = await this.db
        .select()
        .from(organizations)
        .where(
          and(
            ilike(organizations.legalName, params.legalName),
            eq(organizations.emailDomain, params.emailDomain),
            eq(organizations.subscriptionStatus, 'ghost'),
          ),
        );
      for (const m of matches) {
        if (!candidates.find((c) => c.organisationId === m.id)) {
          candidates.push({
            organisationId: m.id,
            name: m.name,
            abn: m.abn,
            legalName: m.legalName,
            primaryEmail: m.primaryEmail,
            emailDomain: m.emailDomain,
            subscriptionStatus: m.subscriptionStatus,
            matchType: 'name_domain',
          });
        }
      }
    }

    return candidates;
  }

  async findGhostsByTenant(params: {
    tenantId: string;
  }): Promise<GhostOrganisation[]> {
    const ghostCols = {
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      abn: organizations.abn,
      legalName: organizations.legalName,
      tradingName: organizations.tradingName,
      primaryEmail: organizations.primaryEmail,
      emailDomain: organizations.emailDomain,
      phone: organizations.phone,
      subscriptionStatus: organizations.subscriptionStatus,
    };

    const [poGhosts, quoteGhosts] = await Promise.all([
      this.db
        .selectDistinctOn([organizations.id], ghostCols)
        .from(organizations)
        .innerJoin(
          purchaseOrders,
          and(
            eq(purchaseOrders.issuerOrganisationId, organizations.id),
            eq(purchaseOrders.custodianTenantId, params.tenantId),
          ),
        )
        .where(eq(organizations.subscriptionStatus, 'ghost')),
      this.db
        .selectDistinctOn([organizations.id], ghostCols)
        .from(organizations)
        .innerJoin(
          quotes,
          and(
            eq(quotes.issuerOrganisationId, organizations.id),
            eq(quotes.custodianTenantId, params.tenantId),
          ),
        )
        .where(eq(organizations.subscriptionStatus, 'ghost')),
    ]);

    const seen = new Set<string>();
    const result: GhostOrganisation[] = [];
    for (const row of [...poGhosts, ...quoteGhosts]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        result.push(row);
      }
    }
    return result;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'ghost-org';
  }

  private extractEmailDomain(email?: string): string | null {
    if (!email) return null;
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : null;
  }
}
