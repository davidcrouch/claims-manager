import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
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
  }): Promise<LookupValueRow[]> {
    return this.db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, params.domain),
          eq(lookupValues.isActive, true),
        ),
      )
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
}
