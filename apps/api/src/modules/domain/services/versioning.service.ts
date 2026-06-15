import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { documentVersions } from '../../../database/schema';

export type DocumentVersionRow = typeof documentVersions.$inferSelect;

@Injectable()
export class VersioningService {
  private readonly logger = new Logger('VersioningService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Create a version snapshot for a document about to be issued.
   * Supersedes the previous version (if any) and inserts a new row.
   */
  async createSnapshot(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    entitySnapshot: Record<string, unknown>;
    lineItemSnapshot: unknown[];
    issuedByUserId?: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ versionNumber: number }> {
    const db = params.tx;

    // Find current max version
    const [latest] = await db
      .select({ versionNumber: documentVersions.versionNumber })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.tenantId, params.tenantId),
          eq(documentVersions.documentType, params.documentType),
          eq(documentVersions.documentId, params.documentId),
        ),
      )
      .orderBy(desc(documentVersions.versionNumber))
      .limit(1);

    const nextVersion = (latest?.versionNumber ?? 0) + 1;
    const now = new Date();

    // Supersede previous version
    if (latest) {
      await db
        .update(documentVersions)
        .set({ supersededAt: now })
        .where(
          and(
            eq(documentVersions.tenantId, params.tenantId),
            eq(documentVersions.documentType, params.documentType),
            eq(documentVersions.documentId, params.documentId),
            eq(documentVersions.versionNumber, latest.versionNumber),
          ),
        );
    }

    // Insert new version
    await db.insert(documentVersions).values({
      tenantId: params.tenantId,
      documentType: params.documentType,
      documentId: params.documentId,
      versionNumber: nextVersion,
      snapshot: params.entitySnapshot,
      lineItemSnapshot: params.lineItemSnapshot,
      issuedAt: now,
      issuedByUserId: params.issuedByUserId,
      metadata: {},
    });

    this.logger.log(
      `VersioningService.createSnapshot — ${params.documentType}:${params.documentId} → v${nextVersion}`,
    );

    return { versionNumber: nextVersion };
  }

  /**
   * Get the latest (non-superseded) version for a document.
   */
  async getLatestVersion(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentVersionRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.tenantId, params.tenantId),
          eq(documentVersions.documentType, params.documentType),
          eq(documentVersions.documentId, params.documentId),
          isNull(documentVersions.supersededAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Get the full version history for a document, newest first.
   */
  async getVersionHistory(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentVersionRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.tenantId, params.tenantId),
          eq(documentVersions.documentType, params.documentType),
          eq(documentVersions.documentId, params.documentId),
        ),
      )
      .orderBy(desc(documentVersions.versionNumber));
  }

  /**
   * Get a specific version snapshot.
   */
  async getVersion(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    versionNumber: number;
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentVersionRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.tenantId, params.tenantId),
          eq(documentVersions.documentType, params.documentType),
          eq(documentVersions.documentId, params.documentId),
          eq(documentVersions.versionNumber, params.versionNumber),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}
