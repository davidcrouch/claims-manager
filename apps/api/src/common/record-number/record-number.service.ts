import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../database/drizzle.module';
import { tenantRecordSequences } from '../../database/schema';
import {
  formatRecordNumber,
  RECORD_NUMBER_CONFIG,
  type RecordNumberEntity,
} from './record-number.config';

@Injectable()
export class RecordNumberService {
  private readonly logger = new Logger('api:RecordNumberService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Atomically assigns the next record number for a tenant/entity pair.
   * Safe to call inside an existing transaction via `tx`.
   */
  async next(params: {
    tenantId: string;
    entity: RecordNumberEntity;
    tx?: DrizzleDbOrTx;
  }): Promise<string> {
    const config = RECORD_NUMBER_CONFIG[params.entity];
    const db = params.tx ?? this.db;
    const nextAfterAssign = config.startValue + 1;

    const [row] = await db
      .insert(tenantRecordSequences)
      .values({
        tenantId: params.tenantId,
        sequenceKey: params.entity,
        nextValue: nextAfterAssign,
      })
      .onConflictDoUpdate({
        target: [tenantRecordSequences.tenantId, tenantRecordSequences.sequenceKey],
        set: {
          nextValue: sql`${tenantRecordSequences.nextValue} + 1`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        assigned: sql<number>`${tenantRecordSequences.nextValue} - 1`,
      });

    const assigned = Number(row?.assigned);
    if (!Number.isFinite(assigned)) {
      throw new Error(
        `api:RecordNumberService.next failed to assign number for ${params.entity}`,
      );
    }

    const formatted = formatRecordNumber(config.prefix, assigned);
    this.logger.debug(
      `api:RecordNumberService.next tenantId=${params.tenantId} entity=${params.entity} → ${formatted}`,
    );
    return formatted;
  }

  /** Returns true when the value is missing or only whitespace. */
  isBlank(value: unknown): boolean {
    return typeof value !== 'string' || value.trim().length === 0;
  }

  /**
   * Resolves an explicit number from input, or assigns the next auto number.
   */
  async resolve(params: {
    tenantId: string;
    entity: RecordNumberEntity;
    explicit?: unknown;
    tx?: DrizzleDbOrTx;
  }): Promise<string> {
    if (!this.isBlank(params.explicit)) {
      return String(params.explicit).trim();
    }
    return this.next({ tenantId: params.tenantId, entity: params.entity, tx: params.tx });
  }
}
