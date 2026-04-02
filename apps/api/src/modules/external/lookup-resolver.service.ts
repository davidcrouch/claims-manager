import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/drizzle.module';
import type { DrizzleDB } from '../../database/drizzle.module';
import { lookupValues, externalReferenceResolutionLog } from '../../database/schema';

@Injectable()
export class LookupResolver {
  private readonly logger = new Logger('LookupResolver');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async resolve(params: {
    tenantId: string;
    domain: string;
    externalReference: string;
    autoCreate?: boolean;
  }): Promise<string | null> {
    if (!params.externalReference) return null;

    const [existing] = await this.db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, params.domain),
          eq(lookupValues.externalReference, params.externalReference),
        ),
      )
      .limit(1);

    if (existing) return existing.id;

    if (params.autoCreate) {
      this.logger.debug(
        `LookupResolver.resolve — auto-creating ${params.domain}/${params.externalReference} for tenant=${params.tenantId}`,
      );
      const [created] = await this.db
        .insert(lookupValues)
        .values({
          tenantId: params.tenantId,
          domain: params.domain,
          externalReference: params.externalReference,
          name: params.externalReference,
          metadata: {},
          isActive: true,
        })
        .returning();
      return created!.id;
    }

    await this.db.insert(externalReferenceResolutionLog).values({
      tenantId: params.tenantId,
      domain: params.domain,
      externalReference: params.externalReference,
      resolutionAction: 'not_found',
      details: {},
    });

    this.logger.warn(
      `LookupResolver.resolve — no match for ${params.domain}/${params.externalReference}, logged to resolution log`,
    );

    return null;
  }
}
