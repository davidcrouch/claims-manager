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
}
