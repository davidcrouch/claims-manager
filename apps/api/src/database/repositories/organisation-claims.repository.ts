import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { organisationClaims } from '../schema';

export type OrganisationClaimRow = typeof organisationClaims.$inferSelect;
export type OrganisationClaimInsert = typeof organisationClaims.$inferInsert;

@Injectable()
export class OrganisationClaimsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByGhostOrgId(params: {
    ghostOrganisationId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<OrganisationClaimRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(organisationClaims)
      .where(eq(organisationClaims.ghostOrganisationId, params.ghostOrganisationId))
      .orderBy(desc(organisationClaims.createdAt));
  }

  async findByClaimingTenant(params: {
    claimingTenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<OrganisationClaimRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(organisationClaims)
      .where(eq(organisationClaims.claimingTenantId, params.claimingTenantId))
      .orderBy(desc(organisationClaims.createdAt));
  }

  async findOne(params: {
    id: string;
    tx?: DrizzleDbOrTx;
  }): Promise<OrganisationClaimRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(organisationClaims)
      .where(eq(organisationClaims.id, params.id))
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    data: OrganisationClaimInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<OrganisationClaimRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(organisationClaims)
      .values(params.data)
      .returning();
    return row;
  }

  async update(params: {
    id: string;
    data: Partial<OrganisationClaimInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<OrganisationClaimRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(organisationClaims)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(organisationClaims.id, params.id))
      .returning();
    return updated ?? null;
  }
}
