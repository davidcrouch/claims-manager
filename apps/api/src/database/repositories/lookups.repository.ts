import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { lookupValues } from '../schema';

export type LookupValueRow = typeof lookupValues.$inferSelect;

@Injectable()
export class LookupsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByDomain(params: {
    tenantId: string;
    domain: string;
    providerCode?: string;
  }): Promise<LookupValueRow[]> {
    const conditions = [
      eq(lookupValues.tenantId, params.tenantId),
      eq(lookupValues.domain, params.domain),
      eq(lookupValues.isActive, true),
    ];
    if (params.providerCode) {
      conditions.push(eq(lookupValues.providerCode, params.providerCode));
    }
    return this.db
      .select()
      .from(lookupValues)
      .where(and(...conditions))
      .orderBy(asc(lookupValues.name));
  }

  async findOne(params: { id: string; tenantId: string }): Promise<LookupValueRow | null> {
    const [row] = await this.db
      .select()
      .from(lookupValues)
      .where(and(eq(lookupValues.id, params.id), eq(lookupValues.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByIds(params: { ids: string[]; tenantId: string }): Promise<Map<string, LookupValueRow>> {
    if (params.ids.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          inArray(lookupValues.id, params.ids),
        ),
      );
    const map = new Map<string, LookupValueRow>();
    for (const row of rows) {
      map.set(row.id, row);
    }
    return map;
  }

  async create(params: {
    tenantId: string;
    data: {
      domain: string;
      name: string;
      externalReference?: string;
      providerCode?: string | null;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    };
  }): Promise<LookupValueRow> {
    const [row] = await this.db
      .insert(lookupValues)
      .values({
        tenantId: params.tenantId,
        domain: params.data.domain,
        name: params.data.name,
        externalReference: params.data.externalReference ?? null,
        providerCode: params.data.providerCode ?? null,
        isActive: params.data.isActive ?? true,
        metadata: params.data.metadata ?? {},
      })
      .returning();
    return row;
  }

  async findByName(params: {
    tenantId: string;
    domain: string;
    name: string;
  }): Promise<LookupValueRow | null> {
    const [row] = await this.db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, params.domain),
          eq(lookupValues.name, params.name),
          eq(lookupValues.isActive, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByDomainAndNames(params: {
    tenantId: string;
    domain: string;
    names: string[];
  }): Promise<Map<string, string>> {
    if (params.names.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, params.domain),
          inArray(lookupValues.name, params.names),
          eq(lookupValues.isActive, true),
        ),
      );
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.name) map.set(row.name, row.id);
    }
    return map;
  }

  async findOrCreateByName(params: {
    tenantId: string;
    domain: string;
    name: string;
  }): Promise<LookupValueRow> {
    const existing = await this.findByName(params);
    if (existing) return existing;
    return this.create({
      tenantId: params.tenantId,
      data: {
        domain: params.domain,
        name: params.name,
        externalReference: `${params.domain}-${params.name.toLowerCase().replace(/\s+/g, '-')}`,
      },
    });
  }
}
